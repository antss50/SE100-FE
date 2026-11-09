import { z } from 'zod'
import type { CreateUserResponseData } from '../../types/api'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody, sameText } from '../http'
import type { MockRoute } from '../router'
import type { MockUser } from '../seed/users'
import { toIsoLocal } from '../time'
import { toAuthUser } from './auth'

const createUserSchema = z.object({
  employeeCode: z.string().trim().optional(),
  username: z.string().trim().min(3, 'Tên đăng nhập tối thiểu 3 ký tự'),
  password: z.string().min(8, 'Mật khẩu tạm tối thiểu 8 ký tự'),
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  email: z.email('Email không hợp lệ'),
  phoneNumber: z.string().trim().regex(/^[0-9]{10,11}$/, 'Số điện thoại phải có 10–11 chữ số'),
  roleIds: z.array(z.number().int()).min(1, 'Chọn ít nhất 1 vai trò'),
})

const updateUserSchema = z.object({
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên').optional(),
  email: z.email('Email không hợp lệ').optional(),
  phoneNumber: z.string().trim().regex(/^[0-9]{10,11}$/, 'Số điện thoại phải có 10–11 chữ số').optional(),
  jobTitle: z.string().trim().optional(),
})

const lockSchema = z.object({ reason: z.string().trim().optional() }).optional()

function findUser(users: MockUser[], idOrCode: string): MockUser {
  const found = users.find(
    (u) => String(u.id) === idOrCode || sameText(u.employeeCode, idOrCode) || sameText(u.username, idOrCode)
  )
  if (!found) throw notFound('USER_NOT_FOUND', 'Không tìm thấy tài khoản nhân viên')
  return found
}

export const userRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/users/me',
    handler: ({ db, user }) => ok(toAuthUser(db, user as MockUser), 'Lấy thông tin tài khoản thành công'),
  },
  {
    method: 'GET',
    path: '/users',
    permission: 'USER_MANAGE',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const role = query.get('role')
      const status = query.get('status')
      const items = db.read('users').filter(
        (u) =>
          (!kw ||
            [u.fullName, u.employeeCode, u.username, u.email, u.phoneNumber].some((v) =>
              v.toLowerCase().includes(kw)
            )) &&
          (!role || u.roles.includes(role)) &&
          (!status || u.status === status)
      )
      return ok(paginate(items, query), 'Lấy danh sách người dùng thành công')
    },
  },
  {
    method: 'POST',
    path: '/users',
    permission: 'USER_MANAGE',
    handler: ({ db, body }) => {
      const input = parseBody(createUserSchema, body)
      const users = db.read('users')
      const nextNumber = users.reduce((max, u) => Math.max(max, Number(/^NV(\d+)$/i.exec(u.employeeCode)?.[1] ?? 0)), 0) + 1
      const employeeCode = (input.employeeCode || `NV${String(nextNumber).padStart(4, '0')}`).toUpperCase()
      if (
        users.some(
          (u) =>
            sameText(u.username, input.username) ||
            sameText(u.employeeCode, employeeCode) ||
            sameText(u.email, input.email)
        )
      ) {
        throw new MockHttpError(409, 'USER_EXISTED', 'Tên đăng nhập, mã nhân viên hoặc email đã tồn tại')
      }
      const roles = db.read('roles').filter((r) => input.roleIds.includes(r.id))
      if (roles.length !== input.roleIds.length) {
        throw new MockHttpError(400, 'ROLE_NOT_FOUND', 'Vai trò không tồn tại')
      }
      const id = users.reduce((max, u) => Math.max(max, u.id), 0) + 1
      const created: MockUser = {
        id,
        employeeCode,
        username: input.username,
        fullName: input.fullName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        status: 'ACTIVE',
        roles: roles.map((r) => r.roleCode),
        jobTitle: 'Nhân sự vận hành điểm bán',
        lastLoginAt: undefined,
        isOnline: false,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      }
      db.write('users', [created, ...users])
      const passwords = db.read('passwords')
      passwords[String(id)] = input.password
      db.touch('passwords')
      const data: CreateUserResponseData = { id, employeeCode: created.employeeCode, username: created.username }
      return ok(data, 'Tạo tài khoản nhân viên thành công', 201)
    },
  },
  {
    method: 'GET',
    path: '/users/:idOrCode',
    permission: 'USER_MANAGE',
    handler: ({ db, params }) => ok(findUser(db.read('users'), params.idOrCode)),
  },
  {
    method: 'PATCH',
    path: '/users/:id',
    permission: 'USER_MANAGE',
    handler: ({ db, params, body }) => {
      const input = parseBody(updateUserSchema, body)
      const users = db.read('users')
      const target = findUser(users, params.id)
      if (input.email && users.some((u) => u.id !== target.id && sameText(u.email, input.email))) {
        throw new MockHttpError(409, 'USER_EXISTED', 'Email đã được dùng cho tài khoản khác')
      }
      Object.assign(target, input)
      db.touch('users')
      return ok(target, 'Cập nhật thông tin nhân viên thành công')
    },
  },
  {
    method: 'POST',
    path: '/users/:id/lock',
    permission: 'USER_MANAGE',
    handler: ({ db, params, body, user, now }) => {
      const input = parseBody(lockSchema, body)
      const target = findUser(db.read('users'), params.id)
      if (target.id === user?.id) {
        throw new MockHttpError(422, 'AUTH_CANNOT_LOCK_SELF', 'Không thể tự khóa tài khoản của chính mình')
      }
      if (target.status === 'LOCKED') {
        throw new MockHttpError(409, 'USER_ALREADY_LOCKED', 'Tài khoản đã bị khóa')
      }
      target.status = 'LOCKED'
      target.lockReason = input?.reason || 'Tạm khóa bởi quản trị viên'
      target.lockedDate = toIsoLocal(now)
      target.isOnline = false
      db.touch('users')
      // Luật 52: khóa tài khoản thì thu hồi phiên ngay.
      db.write('sessions', db.read('sessions').filter((s) => s.userId !== target.id))
      return ok(target, 'Đã khóa tài khoản nhân viên')
    },
  },
  {
    method: 'POST',
    path: '/users/:id/unlock',
    permission: 'USER_MANAGE',
    handler: ({ db, params }) => {
      const target = findUser(db.read('users'), params.id)
      if (target.status !== 'LOCKED' && !target.lockedUntil) {
        throw new MockHttpError(409, 'USER_NOT_LOCKED', 'Tài khoản đang hoạt động')
      }
      target.status = 'ACTIVE'
      target.lockReason = undefined
      target.lockedDate = undefined
      target.lockedUntil = null
      target.failedLoginCount = 0
      db.touch('users')
      return ok(target, 'Đã mở khóa tài khoản nhân viên')
    },
  },
]

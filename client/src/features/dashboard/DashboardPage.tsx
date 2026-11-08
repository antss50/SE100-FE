import {
  ArrowRight,
  Award,
  Boxes,
  KeyRound,
  Shield,
  Tag,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const moduleCards = [
  {
    title: 'Khuyến mãi 4 Tầng & Chính sách Bán hàng (G11)',
    subtitle: 'GET/POST/PUT /api/v1/promotions · /pause · /report',
    description:
      'Quản lý khung khuyến mãi 4 tầng (Flash Sale, Hạng thẻ, Bậc thang, Điểm thưởng), tạo/sửa/tạm dừng Voucher và xem báo cáo hiệu quả.',
    to: '/promotions',
    icon: Tag,
    badge: 'UC-PROM-01..07',
  },
  {
    title: 'Hệ thống 4 Hạng thẻ & Tích điểm (G10)',
    subtitle: 'PUT /api/v1/loyalty-config · Đồng, Bạc, Vàng, Kim Cương',
    description:
      'Cấu hình tỷ lệ quy đổi điểm thưởng (amountPerPoint) và ngưỡng chi tiêu thăng hạng tự động cho 4 hạng thành viên Lumina VIP.',
    to: '/loyalty',
    icon: Award,
    badge: 'UC-CUS-09',
  },
  {
    title: 'Sản phẩm, Danh mục & Thương hiệu',
    subtitle: 'POST /api/v1/products · /categories · /brands',
    description:
      'Quản lý 1.240 SKU mỹ phẩm, khởi tạo danh mục nội bộ, thương hiệu phân phối, quy cách đóng gói, thuế VAT và định mức tồn an toàn.',
    to: '/products',
    icon: Boxes,
    badge: 'UC-PROD-01..03',
  },
  {
    title: 'Xác thực POS & Mở Ca (G02 · G12)',
    subtitle: 'POST /api/v1/auth/login · /change-password · /shifts/open',
    description:
      'Đăng nhập POS theo mã nhân viên/username, tự động khóa 30 phút khi sai mật khẩu 5 lần, đổi mật khẩu Bcrypt và khai báo tiền mặt mở ca.',
    to: '/login',
    icon: KeyRound,
    badge: 'Module Auth',
  },
  {
    title: 'Quản lý Tài khoản Nhân viên (G02)',
    subtitle: 'GET /api/v1/users · POST /api/v1/users · GET /users/me',
    description:
      'Tra cứu danh sách nhân sự, tạo tài khoản nhân viên mới, theo dõi ca trực, doanh thu 7 ngày và nhật ký hoạt động bảo mật.',
    to: '/users',
    icon: Users,
    badge: '32 Nhân sự',
  },
  {
    title: 'Chi tiết Hoạt động Nhân viên',
    subtitle: 'Hồ sơ Nguyễn Thu Hà (LUM-084) · Thu ngân POS',
    description:
      'Xem biểu đồ doanh thu thuần 7 ngày, trạng thái bảo mật tài khoản (0/5 lần sai mật khẩu), thu hồi phiên đăng nhập và nhật ký OVERRIDE_FEFO.',
    to: '/users/LUM-084',
    icon: UserCheck,
    badge: 'LUM-084',
  },
  {
    title: 'Phân quyền & Ma trận Vai trò RBAC (G02)',
    subtitle: 'GET /rbac/roles · GET /rbac/permissions · PUT /roles/:id/permissions',
    description:
      'Ma trận 24 quyền hạn chia theo 6 nhóm nghiệp vụ cho 4 vai trò chuẩn (ADMIN, STORE_MANAGER, INVENTORY_STAFF, CASHIER) kèm Audit Log truy vết.',
    to: '/rbac',
    icon: Shield,
    badge: 'RBAC Matrix',
  },
  {
    title: 'Quản lý Khách hàng & Hội viên (G06)',
    subtitle: 'GET /api/v1/customers · Lọc hạng thẻ Đồng, Bạc, Vàng, Kim Cương',
    description:
      'Danh sách 3,842 khách hàng hội viên, tra cứu nhanh bằng phím tắt (/), lọc theo hạng thành viên, điểm thưởng khả dụng và tổng chi tiêu.',
    to: '/customers',
    icon: Users,
    badge: 'CRM & Loyalty',
  },
  {
    title: 'Thêm mới & Hồ sơ VIP Khách hàng (G06)',
    subtitle: 'POST /api/v1/customers · GET /api/v1/customers/:customerCode',
    description:
      'Form thêm mới khách hàng kèm kiểm tra trùng SĐT (409 Conflict), phân loại làn da/dị ứng mỹ phẩm và thẻ đặc quyền Lumina VIP Club.',
    to: '/customers/KH-2024-001',
    icon: UserPlus,
    badge: 'VIP Club',
  },
]

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#8f422a] via-[#a8553a] to-[#6d2f1b] text-white p-6 sm:p-8 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <span className="px-3 py-1 rounded-full bg-white/15 text-amber-100 font-mono text-[11px] font-bold uppercase tracking-wider">
            Sprint 02 · G02 & G06 · Lumina Beauty POS & ERP
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
            Dashboard tổng quan
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-amber-100/90 max-w-2xl leading-relaxed">
            Chọn nhanh các phân hệ bên dưới hoặc từ thanh điều hướng bên trái để
            trải nghiệm đầy đủ các màn hình theo thiết kế UI và API Contract.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            to="/customers/new"
            className="px-4 py-2.5 rounded-xl bg-black/25 border border-white/25 text-white text-xs font-bold hover:bg-black/35 transition"
          >
            + Thêm mới Khách hàng
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {moduleCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.to}
              to={card.to}
              className="group rounded-3xl bg-white border border-[#ead9ce] hover:border-[#c97a5d] p-6 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-2xl bg-[#fbeae2] text-[#9a462d] grid place-items-center">
                    <Icon className="size-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#faf1ea] text-[#9a462d] font-mono text-[10px] font-bold">
                    {card.badge}
                  </span>
                </div>

                <h2 className="mt-4 text-base font-extrabold text-[#221712] group-hover:text-[#9a462d] transition">
                  {card.title}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-[#8d7467]">
                  {card.subtitle}
                </p>
                <p className="mt-2.5 text-xs text-[#695246] leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#f3e7df] flex items-center justify-between text-xs font-bold text-[#9a462d]">
                <span>Mở màn hình chức năng</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

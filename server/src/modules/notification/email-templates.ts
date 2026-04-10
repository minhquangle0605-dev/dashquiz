const baseLayout = (content: string) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.06);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:24px 32px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-.3px;">WebQuiz</h1>
              <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px;">High School Learning Analytics</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} WebQuiz — Hệ thống Kiểm tra Trực tuyến</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function examResultEmail(params: {
  parentName: string;
  studentName: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  submittedAt: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const passed = params.score >= 5;
  const scoreColor = passed ? '#10b981' : '#ef4444';
  const scoreIcon = passed ? '✅' : '⚠️';

  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">Kết quả Bài kiểm tra</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Xin chào <strong>${params.parentName}</strong>,</p>
    <p style="color:#334155;font-size:14px;line-height:1.7;">
      Con bạn <strong>${params.studentName}</strong> đã hoàn thành bài kiểm tra. Dưới đây là kết quả:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:20px;margin:20px 0;">
      <tr>
        <td>
          <p style="margin:0 0 12px;font-size:14px;color:#64748b;">📝 <strong>Bài kiểm tra:</strong> ${params.examTitle}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#64748b;">📅 <strong>Thời gian nộp:</strong> ${params.submittedAt}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#64748b;">✏️ <strong>Số câu đúng:</strong> ${params.correctCount}/${params.totalQuestions}</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:${scoreColor};">
            ${scoreIcon} Điểm: ${params.score}/10
          </p>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${params.dashboardUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Xem chi tiết trên Dashboard
      </a>
    </div>
  `;

  return {
    subject: `${scoreIcon} Kết quả bài KT: ${params.examTitle} — ${params.studentName} đạt ${params.score} điểm`,
    html: baseLayout(content),
  };
}

export function newExamAssignedEmail(params: {
  studentName: string;
  examTitle: string;
  subjectName: string;
  durationMin: number;
  teacherName: string;
  examListUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">📝 Bài kiểm tra mới</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Xin chào <strong>${params.studentName}</strong>,</p>
    <p style="color:#334155;font-size:14px;line-height:1.7;">
      Giáo viên đã giao cho bạn một bài kiểm tra mới:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:20px;margin:20px 0;">
      <tr>
        <td>
          <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1e293b;">📋 ${params.examTitle}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;">📚 Môn: <strong>${params.subjectName}</strong></p>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;">⏱️ Thời gian: <strong>${params.durationMin} phút</strong></p>
          <p style="margin:0;font-size:13px;color:#64748b;">👨‍🏫 Giáo viên: <strong>${params.teacherName}</strong></p>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${params.examListUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Xem danh sách bài kiểm tra
      </a>
    </div>
  `;

  return {
    subject: `📝 Bài KT mới: ${params.examTitle} — ${params.subjectName}`,
    html: baseLayout(content),
  };
}

export function accountVerificationEmail(params: {
  fullName: string;
  username: string;
  role: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">🎉 Chào mừng đến với WebQuiz!</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Xin chào <strong>${params.fullName}</strong>,</p>
    <p style="color:#334155;font-size:14px;line-height:1.7;">
      Tài khoản của bạn đã được tạo thành công trên hệ thống WebQuiz.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:20px 0;">
      <tr>
        <td>
          <p style="margin:0 0 10px;font-size:14px;color:#334155;">👤 <strong>Tên đăng nhập:</strong> ${params.username}</p>
          <p style="margin:0;font-size:14px;color:#334155;">🎭 <strong>Vai trò:</strong> ${params.role}</p>
        </td>
      </tr>
    </table>
    <p style="color:#64748b;font-size:13px;line-height:1.6;">
      Vui lòng đăng nhập và đổi mật khẩu mặc định ngay lần đầu sử dụng.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${params.loginUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Đăng nhập ngay
      </a>
    </div>
  `;

  return {
    subject: '🎉 Chào mừng đến WebQuiz — Tài khoản của bạn đã sẵn sàng',
    html: baseLayout(content),
  };
}

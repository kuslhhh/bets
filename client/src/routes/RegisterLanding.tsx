import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toMessage } from "../lib/errors";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import meterImg from "../assets/meter.png";
import chartImg from "../assets/chart.png";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).regex(/[A-Z]/, "must contain uppercase").regex(/[a-z]/, "must contain lowercase").regex(/[0-9]/, "must contain digit"),
  phoneNumber: z.string().max(20).optional(),
  name: z.string().min(1).max(200),
  designation: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
  industryType: z.string().optional(),
  natureOfWork: z.string().optional(),
  revenueBracket: z.string().optional(),
  product: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

const loginSchema = z.object({ email: z.string().min(3).max(254), password: z.string().min(1) });
type LoginValues = z.infer<typeof loginSchema>;

const forgotSchema = z.object({ email: z.string().min(3).max(254).email() });
type ForgotValues = z.infer<typeof forgotSchema>;

const otpResetSchema = z
  .object({
    otp: z.string().min(4).max(10),
    newPassword: z.string().min(8).regex(/[A-Z]/, "must contain uppercase").regex(/[a-z]/, "must contain lowercase").regex(/[0-9]/, "must contain digit"),
    confirm: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.confirm, { message: "passwords do not match", path: ["confirm"] });
type OtpResetValues = z.infer<typeof otpResetSchema>;

export function RegisterLandingPage() {
  const nav = useNavigate();
  const { user, setAuth } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [mode, setMode] = useState<"register" | "login" | "forgot">("register");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [forgotErr, setForgotErr] = useState<string | null>(null);
  const [forgotStep, setForgotStep] = useState<"email" | "otp">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDone, setForgotDone] = useState(false);
  const [otpErr, setOtpErr] = useState<string | null>(null);
  const [otpOk, setOtpOk] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);

  if (user) {
    setTimeout(() => nav("/available"), 0);
  }

  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const forgotForm = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });
  const otpForm = useForm<OtpResetValues>({ resolver: zodResolver(otpResetSchema) });

  const onForgot = forgotForm.handleSubmit(async (v) => {
    setForgotErr(null);
    setOtpInfo(null);
    try {
      const res = (await apiFetch("/auth/forgot-password", { method: "POST", body: { email: v.email } })) as { ok: boolean; devOtp?: string };
      setForgotEmail(v.email);
      setForgotStep("otp");
      setOtpErr(null);
      setOtpOk(false);
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
        console.log("[otp:dev] devOtp for", v.email, res.devOtp);
      } else {
        setDevOtp(null);
      }
      setOtpInfo("OTP sent. Check server console or dev banner.");
      setTimeout(() => setOtpInfo(null), 4000);
    } catch (e) {
      setForgotErr(toMessage(e));
    }
  });

  const onOtpReset = otpForm.handleSubmit(async (v) => {
    setOtpErr(null);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: { email: forgotEmail, otp: v.otp, newPassword: v.newPassword },
      });
      setOtpOk(true);
      setForgotDone(true);
      setTimeout(() => {
        setMode("login");
        setForgotStep("email");
        setForgotDone(false);
        setOtpOk(false);
        forgotForm.reset();
        otpForm.reset();
      }, 1500);
    } catch (e) {
      setOtpErr(toMessage(e));
    }
  });

  const onLogin = loginForm.handleSubmit(async (v) => {
    setLoginErr(null);
    try {
      const data = (await apiFetch<{ user: { id: string; name: string; email: string; role: string }; accessToken: string }>("/auth/login", {
        method: "POST",
        body: v,
      })) as { user: { id: string; name: string; email: string; role: string }; accessToken: string };
      const me = (await apiFetch<{ user: { id: string; name: string; email: string }; role: string; permissions: string[]; accessToken: string }>(
        "/auth/me",
      )) as { user: { id: string; name: string; email: string }; role: string; permissions: string[]; accessToken: string };
      setAuth(me.user, me.role, me.permissions, me.accessToken ?? data.accessToken);
      nav("/available");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      if (msg.includes("locked")) setLoginErr("Account locked — too many attempts. Try again in 15 minutes.");
      else if (msg.includes("unauthenticated") || msg.includes("401")) setLoginErr("Invalid email or password.");
      else setLoginErr(msg);
    }
  });

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: {
          name: v.name,
          email: v.email,
          password: v.password,
          phoneNumber: v.phoneNumber || undefined,
          designation: v.designation || undefined,
          companyName: v.companyName || undefined,
          industryType: v.industryType || undefined,
          natureOfWork: v.natureOfWork || undefined,
          revenueBracket: v.revenueBracket || undefined,
          product: v.product || undefined,
        },
      });
      setOk(true);
      loginForm.setValue("email", v.email);
      setTimeout(() => setMode("login"), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.includes("conflict") || msg.includes("409")) setErr("Email already exists.");
      else setErr(msg);
    }
  });

  const labelCls = "text-[12px] font-semibold text-[#2b3440]";
  const inputCls = "mt-1 bg-white border-[#d9dee6]";
  const selectCls =
    "mt-1 h-[38px] w-full rounded-[4px] border border-[#d9dee6] bg-[#eef2f9] px-2.5 text-[13px] text-[#1a1d23] focus:outline-none focus:ring-1 focus:ring-[var(--bets-primary)] focus:border-[var(--bets-primary)]";

  return (
    <div className="min-h-screen bg-white px-3 py-6 sm:px-6 lg:px-10 text-[var(--bets-text)]">
      {/* Centered card — no top header */}
      <main className="mx-auto max-w-[1400px] rounded-[8px] border border-[#e8e8ea] bg-white shadow-[0_6px_24px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-[#e8e8ea]">
          {/* Left — original long-form story */}
          <div className="min-w-0 p-6 sm:p-8 lg:p-10">
            <h1 className="text-center text-[22px] font-bold tracking-tight text-[var(--bets-primary)]">Quick Health Check for Businesses</h1>

            <div className="mt-6 flex justify-center">
              <img src={meterImg} alt="Illustrative health score gauge showing 67 on 0–100 scale" className="w-[300px] max-w-full h-auto" />
            </div>

            <p className="mt-6 text-[13px] leading-[1.75] text-[#111]">
              Despite having good products and technology, many organizations are not able to break barriers to achieve sustainable, profitable growth. Several organizations are found to be struggling for business stability. Hence proper understanding of ‘where are we?’ is the first step in the growth journey. Smart Organizations are always keen to understand where they are at present and where they must improve. BETs has indigenously developed a unique tool that gives an indicative reflection of current realities with reference to proven business practices. In other words, this is ‘QUICK HEALTH CHECK’ of business organizations.
            </p>

            <h2 className="mt-6 text-[17px] font-bold text-[var(--bets-primary)]">Participants would get:</h2>
            <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-[#111]">
              <li><span aria-hidden className="mr-2">•</span>Insightful wisdom about holistic organisational health</li>
              <li><span aria-hidden className="mr-2">•</span>Compares current business practices with proven business practices and quantifies the same</li>
              <li><span aria-hidden className="mr-2">•</span>For visible understanding, Health scores will be presented in graphical format</li>
              <li><span aria-hidden className="mr-2">•</span>This reveals out areas of immediate attention</li>
              <li><span aria-hidden className="mr-2">•</span>These scores will give direction to build sustainable profitable organisation</li>
              <li><span aria-hidden className="mr-2">•</span>BETs offer free interaction with interested organisations</li>
            </ul>

            <h3 className="mt-6 text-[14px] font-bold text-[#111]">Typical outcome of this health check looks like</h3>
            <div className="mt-3">
              <img src={chartImg} alt="Typical profile across seven business dimensions" className="w-full h-auto" />
            </div>
          </div>

          {/* Right — logo, login line, form card, plain disclaimer */}
          <div className="min-w-0 bg-[#f7f7f8] p-6 sm:p-8 lg:p-8">
            <div className="rounded-[6px] border border-[#e8e8ea] bg-white shadow-[0_6px_24px_rgba(0,0,0,0.10)] p-6 sm:p-7">
              <div className="flex flex-col items-center">
                <img src="/logo.svg" alt="BETs" className="h-14 w-auto object-contain" />
              </div>
              {mode === "forgot" ? (
                <div className="mt-5">
                  <h2 className="text-[16px] font-bold text-[#111]">Forgot password</h2>
                  <p className="mt-1 text-[12px] text-[var(--bets-text-muted)]">
                    {forgotStep === "email"
                      ? "Enter your email. If an account exists, an OTP will be sent. In dev the OTP is logged to the server console."
                      : `Enter the OTP sent to ${forgotEmail} and set a new password.`}
                  </p>
                </div>
              ) : mode === "register" ? (
                <p className="mt-5 text-center text-[12px] font-semibold text-[#3a3f47]">
                  Already have an account?{" "}
                  <button type="button" onClick={() => { setMode("login"); setErr(null); }} className="text-[var(--bets-primary)] hover:underline underline-offset-4 font-semibold">
                    Login
                  </button>
                </p>
              ) : (
                <p className="mt-5 text-center text-[12px] font-semibold text-[#3a3f47]">
                  No account?{" "}
                  <button type="button" onClick={() => { setMode("register"); setLoginErr(null); }} className="text-[var(--bets-primary)] hover:underline underline-offset-4 font-semibold">
                    Register
                  </button>
                </p>
              )}

              <form onSubmit={onLogin} className={`mt-5 space-y-4 ${mode === "login" ? "" : "hidden"}`}>
                {ok && <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">Registered — please sign in below.</p>}
                <div>
                  <label className={labelCls}>Email</label>
                  <Input {...loginForm.register("email")} placeholder="you@example.com" autoComplete="email" className={inputCls} />
                  {loginForm.formState.errors.email && <p className="text-xs text-red-600 mt-1">{loginForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <Input type="password" {...loginForm.register("password")} placeholder="Enter your password" autoComplete="current-password" className={inputCls} />
                  {loginForm.formState.errors.password && <p className="text-xs text-red-600 mt-1">{loginForm.formState.errors.password.message}</p>}
                </div>
                {loginErr && <p className="text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{loginErr}</p>}
                <Button type="submit" className="w-full h-10 text-[14px] rounded-[6px] bg-[var(--bets-primary-dark)]">
                  Sign in
                </Button>
                <p className="text-xs text-center text-[var(--bets-text-muted)]">
                  <button type="button" onClick={() => { setMode("forgot"); setLoginErr(null); setForgotStep("email"); setForgotErr(null); setOtpErr(null); setForgotDone(false); setDevOtp(null); setOtpInfo(null); }} className="text-[var(--bets-primary)] hover:underline">Forgot password?</button>
                </p>
              </form>

              <form onSubmit={onForgot} className={`mt-5 space-y-4 ${mode === "forgot" && forgotStep === "email" ? "" : "hidden"}`}>
                <div>
                  <label className={labelCls}>Email</label>
                  <Input {...forgotForm.register("email")} placeholder="you@example.com" autoComplete="email" className={inputCls} />
                  {forgotForm.formState.errors.email && <p className="text-xs text-red-600 mt-1">{forgotForm.formState.errors.email.message}</p>}
                </div>
                {forgotErr && <p className="text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{forgotErr}</p>}
                <Button type="submit" className="w-full h-10 text-[14px] rounded-[6px] bg-[var(--bets-primary-dark)]">Send OTP</Button>
                <p className="text-xs text-center text-[var(--bets-text-muted)]">
                  <button type="button" onClick={() => setMode("login")} className="text-[var(--bets-primary)] hover:underline">Back to login</button>
                </p>
              </form>

              <form onSubmit={onOtpReset} className={`mt-5 space-y-4 ${mode === "forgot" && forgotStep === "otp" ? "" : "hidden"}`}>
                {forgotDone && otpOk ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">Password reset — redirecting to login…</p>
                    <p className="text-xs text-center text-[var(--bets-text-muted)]">
                      <button type="button" onClick={() => { setMode("login"); setForgotDone(false); setForgotStep("email"); }} className="text-[var(--bets-primary)] hover:underline">Back to login</button>
                    </p>
                  </div>
                ) : (
                  <>
                    {devOtp && (
                      <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded">Dev OTP: <span className="font-mono font-bold tracking-widest">{devOtp}</span> (also in server console)</p>
                    )}
                    {otpInfo && <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">{otpInfo}</p>}
                    <div>
                      <label className={labelCls}>OTP</label>
                      <Input {...otpForm.register("otp")} placeholder="6-digit code" inputMode="numeric" maxLength={6} className={inputCls} />
                      {otpForm.formState.errors.otp && <p className="text-xs text-red-600 mt-1">{otpForm.formState.errors.otp.message}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>New password</label>
                      <Input type="password" {...otpForm.register("newPassword")} placeholder="New password" autoComplete="new-password" className={inputCls} />
                      {otpForm.formState.errors.newPassword && <p className="text-xs text-red-600 mt-1">{otpForm.formState.errors.newPassword.message}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Confirm password</label>
                      <Input type="password" {...otpForm.register("confirm")} placeholder="Confirm password" autoComplete="new-password" className={inputCls} />
                      {otpForm.formState.errors.confirm && <p className="text-xs text-red-600 mt-1">{otpForm.formState.errors.confirm.message}</p>}
                    </div>
                    {otpErr && <p className="text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{otpErr}</p>}
                    <Button type="submit" className="w-full h-10 text-[14px] rounded-[6px] bg-[var(--bets-primary-dark)]">Reset password</Button>
                    <p className="text-xs text-center text-[var(--bets-text-muted)] flex justify-center gap-2">
                      <button type="button" onClick={() => { setForgotStep("email"); setOtpErr(null); setOtpInfo(null); }} className="text-[var(--bets-primary)] hover:underline">Change email</button>
                      <span>·</span>
                      <button type="button" onClick={() => { setMode("login"); setForgotStep("email"); setDevOtp(null); setOtpInfo(null); }} className="text-[var(--bets-primary)] hover:underline">Back to login</button>
                    </p>
                    <p className="text-xs text-center text-[var(--bets-text-muted)]">
                      <button type="button" onClick={async () => { setOtpErr(null); setOtpInfo(null); try { const r = (await apiFetch("/auth/forgot-password", { method:"POST", body:{ email: forgotEmail }})) as { devOtp?: string }; if (r?.devOtp) setDevOtp(r.devOtp); setOtpInfo("OTP resent. Check banner / server console."); setTimeout(()=>setOtpInfo(null),4000); } catch(e){ setOtpErr(toMessage(e)); } }} className="text-[var(--bets-primary)] hover:underline">Resend OTP</button>
                    </p>
                  </>
                )}
              </form>

              <form onSubmit={onSubmit} className={`mt-5 space-y-4 ${mode === "register" ? "" : "hidden"}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email</label>
                    <Input {...register("email")} placeholder="Enter your email id" autoComplete="email" className={inputCls} />
                    {formState.errors.email && <p className="text-xs text-red-600 mt-1">{formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <Input type="password" {...register("password")} placeholder="Enter your password" autoComplete="new-password" className={inputCls} />
                    {formState.errors.password && <p className="text-xs text-red-600 mt-1">{formState.errors.password.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <Input {...register("phoneNumber")} placeholder="Enter your phone number" autoComplete="tel" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Name</label>
                    <Input {...register("name")} placeholder="Enter your name" autoComplete="name" className={inputCls} />
                    {formState.errors.name && <p className="text-xs text-red-600 mt-1">{formState.errors.name.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Designation</label>
                    <Input {...register("designation")} placeholder="Enter your designation" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Company Name</label>
                    <Input {...register("companyName")} placeholder="Enter your company name" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Type of Industry</label>
                    <select {...register("industryType")} className={selectCls}>
                      <option value="">Select industry</option>
                      <option>Manufacturing</option>
                      <option>Services</option>
                      <option>Trading</option>
                      <option>IT / Software</option>
                      <option>Healthcare</option>
                      <option>Education</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Nature of Work</label>
                    <select {...register("natureOfWork")} className={selectCls}>
                      <option value="">Select nature of work</option>
                      <option>Operations</option>
                      <option>Management</option>
                      <option>Business Development</option>
                      <option>Technical</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Revenue Bracket</label>
                    <select {...register("revenueBracket")} className={selectCls}>
                      <option value="">Select revenue bracket</option>
                      <option>&lt; 1 Cr</option>
                      <option>1-5 Cr</option>
                      <option>5-25 Cr</option>
                      <option>25-100 Cr</option>
                      <option>&gt; 100 Cr</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Product</label>
                    <Input {...register("product")} placeholder="Enter your product" className={inputCls} />
                  </div>
                </div>

                {err && <p className="text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{err}</p>}
                {ok && <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">Registered — opening sign in…</p>}

                <Button type="submit" className="w-full h-10 text-[14px] rounded-[6px] bg-[var(--bets-primary-dark)]">
                  Register
                </Button>
              </form>
            </div>

            <p className="mt-5 text-[12px] leading-relaxed text-[#222]">
              <span className="font-bold">Disclaimer:</span> The “Quick Health Check for Businesses” tool by BETs provides an overview of your organization’s practices, comparing them with proven business standards. While it offers valuable insights, it should not be regarded as a comprehensive assessment. Results may vary based on specific organizational factors. BETs guarantees that all data provided is secure, used solely for this purpose, and safeguarded with the highest confidentiality standards.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

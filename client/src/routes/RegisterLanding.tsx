import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

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

const gaugeData = [
  { name: "red", value: 55, color: "#d12a2a" },
  { name: "amber", value: 15, color: "#d98c0a" },
  { name: "lime", value: 10, color: "#8cb33a" },
  { name: "green", value: 20, color: "#2f7d32" },
];

const radarData = [
  { subject: "Growth", A: 92, B: 78, C: 62 },
  { subject: "Customer", A: 88, B: 72, C: 58 },
  { subject: "Leadership", A: 95, B: 80, C: 60 },
  { subject: "Partners & Resources", A: 98, B: 82, C: 68 },
  { subject: "People - HR", A: 96, B: 85, C: 62 },
  { subject: "Process", A: 90, B: 78, C: 65 },
  { subject: "Strategy & Plan", A: 94, B: 76, C: 55 },
];

export function RegisterLandingPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (user) {
    setTimeout(() => nav("/available"), 0);
  }

  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

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
      setTimeout(() => nav("/login"), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.includes("conflict") || msg.includes("409")) setErr("Email already exists.");
      else setErr(msg);
    }
  });

  return (
    <div className="min-h-screen bg-white text-[var(--bets-text)]">
      {/* Header — BETs institutional, full-width centered container 1260 */}
      <header className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-[1260px] px-6 lg:px-8 h-[56px] flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="BETs" className="w-7 h-7 object-contain shrink-0" />
            <span className="text-[15px] font-bold tracking-tight text-[#1a1d23]">BETs Consulting</span>
          </Link>
          <Link to="/login" className="text-[13px] font-medium text-[var(--bets-primary)] hover:text-[var(--bets-primary-dark)] hover:underline underline-offset-4">
            Already have an account? Login
          </Link>
        </div>
      </header>

      {/* Main — 65/35 balanced grid, full-width white, strong centered container */}
      <main className="mx-auto max-w-[1260px] px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[63.5%_36.5%] gap-6 lg:gap-11 items-start">
          {/* Left — main content ~65%, tight vertical rhythm */}
          <div className="min-w-0">
            <h1 className="text-[25px] font-bold tracking-tight text-[var(--bets-primary)] leading-none">Quick Health Check for Businesses</h1>

            {/* Figure 1 — gauge as report figure, centered, proportioned 310x155 */}
            <div className="mt-5 flex justify-center">
              <div className="w-[310px]">
                <div className="h-[155px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gaugeData} dataKey="value" startAngle={180} endAngle={0} innerRadius="66%" outerRadius="92%" cx="50%" cy="88%" stroke="none">
                        {gaugeData.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute left-1/2 top-[56%] -translate-x-1/2 text-center">
                    <div className="text-[30px] font-bold leading-none tracking-tight text-black">67</div>
                    <div className="mt-1 w-[60px] h-px mx-auto bg-[#1a1d23] relative">
                      <div className="absolute left-1/2 top-1/2 w-[54px] h-px bg-[#1a1d23] origin-left" style={{ transform: "translateY(-50%) rotate(-18deg)" }} />
                      <div className="absolute left-1/2 top-1/2 w-[7px] h-[7px] bg-[#1a1d23] rounded-full -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <span className="absolute left-1 top-[74%] text-[11px] text-[#6b7280]">0</span>
                  <span className="absolute right-1 top-[74%] text-[11px] text-[#6b7280]">100</span>
                  <span className="absolute right-[17%] top-[21%] text-[11px] text-[#6b7280]">55</span>
                </div>
                <p className="text-center text-[11px] text-[#6b7280] mt-1">Figure 1 — Illustrative health score (0–100 scale)</p>
              </div>
            </div>

            <p className="mt-5 text-[13.5px] leading-[1.7] text-[#2b2e36]">
              Despite having good products and technology, many organizations are not able to break barriers to achieve sustainable, profitable growth. Several organizations are found to be struggling for business stability. Hence proper understanding of ‘where are we?’ is the first step in the growth journey. Smart Organizations are always keen to understand where they are at present and where they must improve. BETs has indigenously developed a unique tool that gives an indicative reflection of current realities with reference to proven business practices. In other words, this is ‘QUICK HEALTH CHECK’ of business organizations.
            </p>

            <h2 className="mt-6 text-[13.5px] font-bold text-[var(--bets-primary)]">Participants would get:</h2>
            <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#2b2e36] list-disc pl-5 marker:text-[#9aa0b0]">
              <li>Insightful wisdom about holistic organisational health</li>
              <li>Compares current business practices with proven business practices and quantifies the same</li>
              <li>For visible understanding, Health scores will be presented in graphical format</li>
              <li>This reveals out areas of immediate attention</li>
              <li>These scores will give direction to build sustainable profitable organisation</li>
              <li>BETs offer free interaction with interested organisations</li>
            </ul>

            <h3 className="mt-6 text-[13px] font-bold text-[#1a1d23]">Typical outcome of this health check looks like</h3>
            <div className="mt-3 border border-[#e5e5e5] bg-white">
              <div className="mx-auto max-w-[480px] h-[260px] p-3 pb-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                    <PolarGrid stroke="#e8eaed" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10.5, fill: "#374151" }} />
                    <Radar name="High" dataKey="A" stroke="#b91c1c" fill="#b91c1c" fillOpacity={0.04} strokeWidth={1.2} />
                    <Radar name="Average" dataKey="B" stroke="#6a7a33" fill="#6a7a33" fillOpacity={0.04} strokeWidth={1.2} />
                    <Radar name="Your org" dataKey="C" stroke="#1e40af" fill="#1e40af" fillOpacity={0.08} strokeWidth={1.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 pb-3 text-[11px] text-[#4b5563]">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-px bg-[#b91c1c]" /> High</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-px bg-[#6a7a33]" /> Average</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-px bg-[#1e40af]" /> Your organisation</span>
              </div>
              <p className="text-center text-[11px] text-[#6b7280] border-t border-[#e5e5e5] py-2">Figure 2 — Typical profile across seven business dimensions (illustrative)</p>
            </div>
          </div>

          {/* Right — registration ~35%, aligned with main content top, not floating */}
          <div className="min-w-0">
            <div className="border border-[#e5e5e5] bg-white rounded-[3px]">
              <form onSubmit={onSubmit} className="p-5 space-y-3.5">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Email <span className="text-[#9aa0b0] font-normal">*</span></label>
                    <Input {...register("email")} placeholder="Enter your email id" autoComplete="email" className="mt-1" />
                    {formState.errors.email && <p className="text-xs text-red-600 mt-1">{formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Password <span className="text-[#9aa0b0] font-normal">*</span></label>
                    <Input type="password" {...register("password")} placeholder="Enter your password" autoComplete="new-password" className="mt-1" />
                    {formState.errors.password && <p className="text-xs text-red-600 mt-1">{formState.errors.password.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Phone Number</label>
                    <Input {...register("phoneNumber")} placeholder="Enter your phone number" autoComplete="tel" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Name <span className="text-[#9aa0b0] font-normal">*</span></label>
                    <Input {...register("name")} placeholder="Enter your name" autoComplete="name" className="mt-1" />
                    {formState.errors.name && <p className="text-xs text-red-600 mt-1">{formState.errors.name.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Designation</label>
                    <Input {...register("designation")} placeholder="Enter your designation" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Company Name</label>
                    <Input {...register("companyName")} placeholder="Enter your company name" className="mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Type of Industry</label>
                    <select {...register("industryType")} className="mt-1 h-[36px] w-full rounded-[2px] border bg-[#fcfcfd] px-2.5 text-[13px] border-[#d1d5db] text-[#1a1d23] focus:outline-none focus:ring-1 focus:ring-[var(--bets-primary)] focus:border-[var(--bets-primary)]">
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
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Nature of Work</label>
                    <select {...register("natureOfWork")} className="mt-1 h-[36px] w-full rounded-[2px] border bg-[#fcfcfd] px-2.5 text-[13px] border-[#d1d5db] text-[#1a1d23] focus:outline-none focus:ring-1 focus:ring-[var(--bets-primary)] focus:border-[var(--bets-primary)]">
                      <option value="">Select nature of work</option>
                      <option>Operations</option>
                      <option>Management</option>
                      <option>Business Development</option>
                      <option>Technical</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Revenue Bracket</label>
                    <select {...register("revenueBracket")} className="mt-1 h-[36px] w-full rounded-[2px] border bg-[#fcfcfd] px-2.5 text-[13px] border-[#d1d5db] text-[#1a1d23] focus:outline-none focus:ring-1 focus:ring-[var(--bets-primary)] focus:border-[var(--bets-primary)]">
                      <option value="">Select revenue bracket</option>
                      <option>&lt; 1 Cr</option>
                      <option>1-5 Cr</option>
                      <option>5-25 Cr</option>
                      <option>25-100 Cr</option>
                      <option>&gt; 100 Cr</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#1a1d23]">Product</label>
                    <Input {...register("product")} placeholder="Enter your product" className="mt-1" />
                  </div>
                </div>

                {err && <p className="text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">{err}</p>}
                {ok && <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2">Registered — redirecting to login…</p>}

                <Button type="submit" className="w-full h-9 text-[13px] rounded-[3px]">
                  Register
                </Button>

                <p className="text-[11px] leading-relaxed text-[#5a5e6b] border-t border-[#e5e5e5] pt-3">
                  <span className="font-semibold text-[#1a1d23]">Disclaimer:</span> The “Quick Health Check for Businesses” tool by BETs provides an overview of your organization’s practices, comparing them with proven business standards. While it offers valuable insights, it should not be regarded as a comprehensive assessment. Results may vary based on specific organizational factors. BETs guarantees that all data provided is secure, used solely for this purpose, and safeguarded with the highest confidentiality standards.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

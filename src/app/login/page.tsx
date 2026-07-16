import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-gray-1 p-6">
      <div className="w-full max-w-sm rounded-xl border border-outline-gray-2 bg-surface-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2 text-lg font-semibold text-ink-gray-8">
          <span className="grid size-8 place-items-center rounded-md bg-brand text-white">S</span>
          Spir-Margin
        </div>
        <h1 className="text-xl font-bold text-ink-gray-9">Sign in</h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">Medical-device sales, lab tracking &amp; banking.</p>
        <LoginForm />
      </div>
    </div>
  );
}

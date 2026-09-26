"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";
import { Spinner } from "@/components/panel/ui";

// Giriş, kayıt ve şifre ekranlarının parçaları. Bu ekranlar yönetim panelinin
// değil, ürünün kapısıdır: tasarımı onaylı görseldeki dili izler (büyük
// editoryal başlık, kartsız form, ikonlu geniş alanlar, oklu ana buton).
// Sayfalar alanı elle yazmaz; buradaki parçaları kullanır.

// Yatay dolgu ikon/düğme durumuna göre ayrıca verilir (className ile ezmek
// Tailwind'de sıraya bağlı kalırdı).
const FIELD =
  "h-[3.25rem] w-full rounded-[10px] border border-line bg-white/70 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-soft/45 hover:border-ink/25 focus:border-ink/50 focus:bg-white disabled:opacity-60 autofill:shadow-[inset_0_0_0_1000px_var(--color-paper)]";

export function AuthHeading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div>
      <h1 className="font-editorial text-[2.75rem] font-medium leading-[0.98] tracking-[-0.02em] text-ink sm:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem] [@media(max-height:820px)]:lg:text-[3.25rem]">
        {title}
      </h1>
      {description && <p className="mt-4 text-[17px] leading-relaxed text-ink-soft sm:mt-5 sm:text-lg lg:text-[1.3125rem]">{description}</p>}
    </div>
  );
}

export function AuthLabel({ htmlFor, children, aside }: { htmlFor: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        {children}
      </label>
      {aside}
    </div>
  );
}

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Alanın solundaki ikon (e-posta, kilit, telefon…). */
  icon?: ReactNode;
}

export function AuthInput({ icon, className = "", ...rest }: AuthInputProps) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">{icon}</span>}
      <input className={`${FIELD} ${icon ? "pl-12" : "pl-4"} pr-4 ${className}`} {...rest} />
    </div>
  );
}

/** Şifre alanı: kilit ikonu ve göster/gizle düğmesi. */
export function AuthPasswordInput(props: Omit<AuthInputProps, "type" | "icon">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">
        <LockIcon size={20} />
      </span>
      <input {...props} type={visible ? "text" : "password"} className={`${FIELD} pl-12 pr-12 ${props.className ?? ""}`} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        aria-pressed={visible}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-soft transition-colors hover:text-ink"
      >
        {visible ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
      </button>
    </div>
  );
}

export function AuthCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-3 text-[15px] text-ink lg:text-base">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-paprika/40 ${
          checked ? "border-ink bg-ink text-paper" : "border-ink/40 bg-white/70"
        }`}
      >
        {checked && <CheckIcon size={15} strokeWidth={2.6} />}
      </span>
      {children}
    </label>
  );
}

export function AuthSubmit({ loading, disabled, children }: { loading?: boolean; disabled?: boolean; children: ReactNode }) {
  // Üstteki dolgu ana eylemi alanlardan ayırır (form `space-y` ile dizilir;
  // margin çökeceği için padding).
  return (
    <div className="pt-2">
      <button
        type="submit"
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className="group flex h-16 w-full items-center justify-center gap-4 rounded-[10px] bg-ink px-6 font-mono text-[14px] uppercase tracking-[0.22em] text-paper transition-colors hover:bg-paprika disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-ink sm:text-[15px] lg:text-base"
      >
        <span>{children}</span>
        {loading ? (
          <Spinner className="h-5 w-5" />
        ) : (
          <ArrowRightIcon size={20} className="transition-transform group-hover:translate-x-1" />
        )}
      </button>
    </div>
  );
}

/** İki çizgi arasında "Hesabın yok mu? Kayıt ol" satırı. */
export function AuthAlternative({ question, href, label }: { question: string; href: string; label: string }) {
  return (
    <div className="mt-8 flex items-center gap-4 text-[15px] lg:mt-10 lg:text-base">
      <span aria-hidden className="h-px flex-1 bg-line" />
      <p className="shrink-0 text-ink-soft">
        {question}{" "}
        <Link href={href} className="font-medium text-paprika hover:underline">
          {label}
        </Link>
      </p>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

export function AuthError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[10px] border border-paprika/30 bg-paprika/5 px-4 py-3 text-sm text-paprika-deep">
      {children}
    </p>
  );
}

export function AuthNotice({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-[10px] border border-herb/30 bg-herb/10 px-4 py-3 text-sm text-herb">
      {children}
    </p>
  );
}

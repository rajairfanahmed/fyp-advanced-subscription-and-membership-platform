import Link from "next/link";
import { Container } from "./Container";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { siteConfig } from "@/config/site";

export default function Footer() {
  const year = new Date().getFullYear();
  
  return (
    <footer data-site-footer className="bg-white border-t border-[var(--color-border)] pt-20 pb-10">
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <BrandLogo markId="brand-mark-footer" className="mb-6" />
            <p className="text-[var(--color-muted)] max-w-sm mb-6 leading-relaxed">
              The premium membership operating system for creators who want recurring revenue from paid content.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-[var(--color-ink)] mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/pricing" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">Pricing</Link></li>
              <li><Link href="/content-preview" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">Content Demo</Link></li>
              <li><Link href="/creators" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">Creators</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[var(--color-ink)] mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">About Us</Link></li>
              <li><Link href="/support" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">Support</Link></li>
              <li><Link href="/contact" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[var(--color-ink)] mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/terms" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">Terms</Link></li>
              <li><Link href="/privacy" className="text-[var(--color-muted)] hover:text-[var(--color-emerald)]">Privacy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-muted)]">
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="w-2 h-2 rounded-full bg-[var(--color-lime)] shadow-[0_0_10px_var(--color-lime)]" title="All systems operational"></div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

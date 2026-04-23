"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#F3F4F6] transition-shadow duration-200 ${scrolled ? "shadow-xs" : ""}`}>
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold text-brand-600">栖安</Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors">功能</a>
          <a href="#pricing" className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors">定价</a>
          <a href="#contact" className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors">关于我们</a>
          <a
            href="/register"
            className="h-9 px-5 inline-flex items-center bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 transition-colors"
          >
            免费试用
          </a>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 text-gray-500" aria-label="导航菜单" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#F3F4F6] bg-white px-6 py-4 space-y-3">
          <a href="#features" className="block text-sm font-medium text-gray-600" onClick={() => setMenuOpen(false)}>功能</a>
          <a href="#pricing" className="block text-sm font-medium text-gray-600" onClick={() => setMenuOpen(false)}>定价</a>
          <a href="#contact" className="block text-sm font-medium text-gray-600" onClick={() => setMenuOpen(false)}>关于我们</a>
          <a
            href="/register"
            className="block w-full h-10 leading-10 text-center bg-brand-600 text-white text-sm font-semibold rounded-md"
          >
            免费试用
          </a>
        </div>
      )}
    </nav>
  );
}

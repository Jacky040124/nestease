"use client";

export function Footer() {
  return (
    <footer className="py-12 px-6 bg-[#111827]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">栖安</h3>
            <p className="text-xs text-white/60">维修管理平台</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">联系我们</h3>
            <p className="text-xs text-white/60">留下微信号，我们主动联系您</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">产品</h3>
            <div className="space-y-1">
              <a href="#features" className="block text-xs text-white/60 hover:text-white transition-colors">功能介绍</a>
              <a href="#workflow" className="block text-xs text-white/60 hover:text-white transition-colors">方案</a>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            &copy; 2026 栖安 &middot; 隐私政策 &middot; 服务条款
          </p>
        </div>
      </div>
    </footer>
  );
}

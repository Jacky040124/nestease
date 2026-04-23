export function MobileLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[#F8F9FA] flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-md font-bold text-gray-900">栖安</div>
          <div className="text-sm text-gray-500 mt-0.5">{title}</div>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-lg shadow-xs border border-[#E5E7EB] p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

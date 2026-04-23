import { Navbar, Hero, PainPoints, Features, AICapabilities, Pricing, Workflow, SocialProof, FinalCTA, Footer } from "@/components/landing";

export default function LandingPage() {
  return (
    <div className="min-h-full">
      <Navbar />
      <Hero />
      <PainPoints />
      <Features />
      <AICapabilities />
      <Pricing />
      <Workflow />
      <SocialProof />
      <FinalCTA />
      <Footer />
    </div>
  );
}

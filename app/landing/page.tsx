import Link from 'next/link'
import ErrorBoundary from '../../src/components/ErrorBoundary'
import NProgressProvider from '../../src/components/NProgressProvider'

export const metadata = {
  title: 'SmartMenu — Digital Menus & Real-time Orders for Cafes',
  description: 'Transform your cafe into a digital experience. QR menus, real-time orders, Google & TripAdvisor integration, and smart analytics.'
}

export default function LandingPage() {
  return (
    <ErrorBoundary>
      <NProgressProvider />
      <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-50 to-white">
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
              Transform your Cafe into a Digital Experience
            </h1>
            <p className="mt-4 text-gray-600 max-w-xl">
              SmartMenu helps cafes and restaurants in tourist areas serve multilingual, app-free QR menus, accept orders in real-time, and grow reviews on Google & TripAdvisor.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-lg shadow">
                Get Started for Free
              </Link>
              <a href="#pricing" className="text-sm text-gray-700 hover:underline">See Pricing</a>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="No Apps" value="QR only" />
              <Stat label="Real-time" value="Orders" />
              <Stat label="Reviews" value="Google/TripAdvisor" />
              <Stat label="Languages" value="AR / EN / FR" />
            </div>
          </div>

          <div className="flex-1">
            <div className="mx-auto max-w-sm">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold">Powerful features built for busy tourist cafes</h2>
        <p className="mt-2 text-gray-600">Everything you need to serve more customers, faster.</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Feature title="QR Menu" description="No apps needed — customers scan and order instantly." />
          <Feature title="Real-time Order Tracking" description="Orders arrive in the kitchen instantly with notifications." />
          <Feature title="Google & TripAdvisor" description="Encourage reviews and increase visibility with built-in links." />
          <Feature title="Smart Analytics" description="Know your best sellers and peak hours—optimize your menu." />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-semibold">Simple pricing that scales with you</h2>
          <p className="mt-2 text-gray-600">Pick a plan that fits your cafe. No hidden fees.</p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Plan name="Basic" price="Free" features={["QR menu","1 cafe","Email support"]} ctaText="Start Free" />
            <Plan name="Pro" price="€29/mo" features={["Realtime orders","Analytics","Google integration"]} highlight ctaText="Start Pro" />
            <Plan name="Enterprise" price="Custom" features={["White-label","SLA & onboarding","Multi-locations"]} ctaText="Contact Sales" />
          </div>
        </div>
      </section>

      {/* Languages and CTA */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold">Multi-lingual menus for tourists</h3>
            <p className="text-gray-600 mt-2">Serve Arabic, English, and French menus automatically to match your guest's language.</p>
          </div>
          <div>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-lg">Get Started</Link>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-gray-500 flex items-center justify-between">
          <div>© {new Date().getFullYear()} SmartMenu — All rights reserved.</div>
          <div>Built for cafes in tourist areas — Multi-language ready.</div>
        </div>
      </footer>
      </main>
    </ErrorBoundary>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-3 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold mt-1">{value}</div>
    </div>
  )
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="h-12 w-12 bg-emerald-100 rounded flex items-center justify-center text-emerald-600 font-bold">✓</div>
      <h4 className="mt-4 font-semibold">{title}</h4>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  )
}

function Plan({ name, price, features, ctaText, highlight }: { name: string; price: string; features: string[]; ctaText: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-6 ${highlight ? 'ring-2 ring-emerald-200 bg-white' : 'bg-white'} shadow-sm`}> 
      <div className="text-sm text-gray-500">{name}</div>
      <div className="mt-2 text-2xl font-bold">{price}</div>
      <ul className="mt-4 space-y-2 text-sm text-gray-600">
        {features.map((f) => (<li key={f}>• {f}</li>))}
      </ul>
      <div className="mt-6">
        <Link href="/signup" className={`w-full inline-block text-center px-4 py-2 rounded ${highlight ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{ctaText}</Link>
      </div>
    </div>
  )
}

function PhoneMockup() {
  return (
    <div className="relative rounded-3xl border bg-black/5 p-4">
      <div className="w-56 mx-auto bg-white rounded-xl overflow-hidden shadow-lg">
        <div className="p-4">
          <div className="h-44 bg-gradient-to-b from-emerald-50 to-white rounded mb-3 flex flex-col justify-center items-start p-3">
            <div className="font-semibold">Café de la Plage</div>
            <div className="text-sm text-gray-500">Menu — EN</div>
            <div className="mt-3 space-y-2 w-full">
              <div className="flex justify-between"><div>Pancakes</div><div>30 MAD</div></div>
              <div className="flex justify-between"><div>Fresh Orange Juice</div><div>25 MAD</div></div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>Scan QR to open</div>
            <div className="bg-gray-100 px-2 py-1 rounded text-xs">Try it</div>
          </div>
        </div>
      </div>
    </div>
  )
}

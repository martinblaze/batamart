import Link from 'next/link'
import {
  ShoppingBag,
  Users,
  Shield,
  TrendingUp,
  Package,
  Heart,
  CheckCircle,
  Zap
} from 'lucide-react'

export default function AboutPage() {
  const features = [
    {
      icon: Shield,
      title: 'Protected Checkout Flow',
      description: 'Payments are processed securely, with seller settlement tied to order completion rules in-app'
    },
    {
      icon: Users,
      title: 'Campus Community',
      description: 'Built for student-to-student commerce with profiles, reviews, and order history'
    },
    {
      icon: Zap,
      title: 'Fast Delivery',
      description: 'Delivery is available through the BATAMART rider workflow where supported'
    },
    {
      icon: Package,
      title: 'Wide Selection',
      description: 'From textbooks to tech gadgets, find everything you need'
    }
  ]

  const stats = [
    { number: '24/7', label: 'Marketplace Access' },
    { number: '72h', label: 'Dispute Window After Delivery' },
    { number: '₦800', label: 'Per-Order Delivery Fee Rule' },
    { number: '10%', label: 'Platform Commission on Completed Sales' }
  ]

  const values = [
    {
      title: 'Trust & Safety',
      description: 'We combine order tracking, dispute handling, and account-level controls to improve marketplace safety.'
    },
    {
      title: 'Community First',
      description: 'Built by students, for students. We understand the unique needs of campus life.'
    },
    {
      title: 'Transparency',
      description: 'Clear pricing, honest reviews, and no hidden fees. What you see is what you get.'
    },
    {
      title: 'Innovation',
      description: 'Constantly improving our platform based on student feedback and needs.'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-full mb-6">
            <Heart className="w-5 h-5" />
            <span className="font-semibold">About BATAMART</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Your Campus Marketplace, Reimagined
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            BATAMART is a campus-focused peer-to-peer marketplace for simpler,
            more reliable buying and selling.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Story
            </h2>
            <div className="w-20 h-1 bg-BATAMART-primary mx-auto rounded-full"></div>
          </div>

          <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
            <p className="text-lg leading-relaxed">
              BATAMART was born from a simple observation: students in UNIVERSITY needed a better way to
              buy and sell items on campus. Traditional online marketplaces were too broad, social
              media groups were chaotic, and there was no way to ensure trust and safety.
            </p>

            <p className="text-lg leading-relaxed">
              We created BATAMART to solve these problems. A platform exclusively for CAMPUS students,
              where you can buy textbooks from a classmate, sell your old phone to someone in the
              next hostel, and manage orders in one place with transparent status updates and support tools.
            </p>

            <p className="text-lg leading-relaxed">
              Today, BATAMART serves thousands of students across all campuses, making campus
              commerce easier, safer, and more convenient than ever before.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              BATAMART by the Numbers
            </h2>
            <p className="text-gray-600">
              Growing stronger every day with the UNIVERSITY community
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-BATAMART-primary mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose BATAMART?
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We've built features that make buying and selling on campus simple, safe, and reliable
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Values
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              The principles that guide everything we do at BATAMART
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {value.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-BATAMART-light to-white p-12 rounded-3xl border-2 border-BATAMART-primary/20">
            <div className="w-16 h-16 bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Our Mission
            </h2>
            <p className="text-xl text-gray-700 leading-relaxed max-w-3xl mx-auto">
              To empower CAMPUS students with a safe, reliable, and convenient platform for
              campus commerce — making it easy to buy what you need and sell what you don't,
              while building a stronger student community.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Join the BATAMART Community Today
          </h2>
          <p className="text-xl mb-8 text-white/90">
            BATAMART is built for practical, everyday campus commerce.
            Start your journey today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-white text-BATAMART-primary hover:bg-gray-100 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl"
            >
              Create Free Account
            </Link>
            <Link
              href="/marketplace"
              className="bg-BATAMART-dark/50 hover:bg-BATAMART-dark text-white border-2 border-white px-8 py-4 rounded-xl font-bold text-lg transition-all"
            >
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

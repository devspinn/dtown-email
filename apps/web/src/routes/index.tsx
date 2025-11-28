import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
// import { useSession } from "../lib/auth-client";
import { Header } from "../components/Header";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  // const navigate = useNavigate();
  // const { data: session, isPending } = useSession();

  // Redirect to dashboard if already logged in
  // if (session && !isPending) {
  //   navigate({ to: "/dashboard" });
  //   return null;
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Header />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Powered Email
            <span className="text-blue-600"> Filtering</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Define rules in plain English. Let Claude AI automatically sort,
            archive, and label your emails. No more inbox overwhelm.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/login"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium transition-colors"
            >
              Get Started
            </Link>
            <a
              href="https://github.com/devspinn/dtown-email"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-lg font-medium transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Example Rule */}
        <div className="mt-12 max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-500 mb-1">
                  Example Rule
                </div>
                <div className="text-lg font-medium text-gray-900 mb-2">
                  "If it looks like a cold sales email, archive it and label it
                  'Cold Sales'"
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Archive
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Label: Cold Sales
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">Powered by Claude AI</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Natural Language Rules
            </h3>
            <p className="text-gray-600">
              Write filtering rules in plain English. No complex regex or
              technical knowledge required.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Intelligent Classification
            </h3>
            <p className="text-gray-600">
              Claude AI understands context and intent, providing accurate email
              classification with confidence scores.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Automatic Actions
            </h3>
            <p className="text-gray-600">
              Archive, label, or delete emails automatically based on your
              rules. Full audit trail included.
            </p>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Common Use Cases
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                Filter Cold Sales Emails
              </h4>
              <p className="text-sm text-gray-600">
                Automatically detect and archive unsolicited sales outreach
                before it clutters your inbox.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                Organize Newsletters
              </h4>
              <p className="text-sm text-gray-600">
                Identify promotional content and newsletters, moving them to
                dedicated folders.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                Prioritize Urgent Messages
              </h4>
              <p className="text-sm text-gray-600">
                Detect time-sensitive emails and label them for immediate
                attention.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                Archive Meeting Invites
              </h4>
              <p className="text-sm text-gray-600">
                Automatically process calendar invites and meeting requests
                based on custom criteria.
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack Badge */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">
              Powered by Claude 3.5 Haiku • Gmail API • Neon Postgres
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

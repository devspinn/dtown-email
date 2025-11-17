import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSession } from "../lib/auth-client";
import { Header } from "../components/Header";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    navigate({ to: "/login" });
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to Your Dashboard
          </h2>
          <p className="text-gray-600">
            You've successfully signed in! This is your protected dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Properties
            </h3>
            <p className="text-3xl font-bold text-blue-600">0</p>
            <p className="text-sm text-gray-500 mt-1">Total properties</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Security Deposits
            </h3>
            <p className="text-3xl font-bold text-green-600">$0</p>
            <p className="text-sm text-gray-500 mt-1">Total pooled</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Yield Earned
            </h3>
            <p className="text-3xl font-bold text-purple-600">$0</p>
            <p className="text-sm text-gray-500 mt-1">Total earnings</p>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            🎉 Authentication Working!
          </h3>
          <p className="text-blue-800">
            Nice nice now lets go do something with it!
          </p>
        </div>
      </div>
    </div>
  );
}

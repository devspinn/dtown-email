import { Link, useNavigate } from "@tanstack/react-router";
import { useSession, authClient } from "../lib/auth-client";

export function Header() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/login" });
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/">
            <h1 className="text-xl font-bold text-gray-900">dtown-email</h1>
          </Link>

          {session && session.user ? (
            // Authenticated state
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <div className="text-gray-900 font-medium">
                  {session.user.name}
                </div>
                <div className="text-gray-500">{session.user.email}</div>
              </div>
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-10 h-10 rounded-full"
                />
              )}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          ) : (
            // Unauthenticated state
            <Link
              to="/login"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

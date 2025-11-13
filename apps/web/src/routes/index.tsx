import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../lib/trpc";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // Query to list all users
  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();

  // Mutation to create a user
  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      refetch();
      setEmail("");
      setName("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate({ email, name });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          YieldPlat - Full Stack Test
        </h1>

        {/* Create User Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Create User</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>
            <button
              type="submit"
              disabled={createUser.isPending}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createUser.isPending ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Users</h2>
          {isLoading ? (
            <p className="text-gray-600">Loading users...</p>
          ) : users && users.length > 0 ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 bg-gray-50 rounded-md border border-gray-200"
                >
                  <p className="font-medium text-gray-900">
                    {user.name || "No name"}
                  </p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  <p className="text-xs text-gray-400 mt-1">ID: {user.id}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">
              No users yet. Create one using the form above!
            </p>
          )}
        </div>

        {/* Connection Status */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
            <span className="text-sm font-medium">
              Connected: Web → tRPC → API → Drizzle → Neon Postgres
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

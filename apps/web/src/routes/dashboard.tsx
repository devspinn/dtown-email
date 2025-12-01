import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSession } from "../lib/auth-client";
import { Header } from "../components/Header";
import { useState } from "react";
import { trpc } from "../lib/trpc";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

// function DashboardPage() {
//   const navigate = useNavigate();
//   const { data: session, isPending } = useSession();

//   if (isPending) {
//     return (
//       <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
//         <div className="text-xl text-gray-600">Loading...</div>
//       </div>
//     );
//   }

//   if (!session) {
//     navigate({ to: "/login" });
//     return null;
//   }

//   return (
//     <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
//       <Header />

//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//           <h2 className="text-2xl font-bold text-gray-900 mb-4">
//             Welcome to Your Dashboard
//           </h2>
//           <p className="text-gray-600">
//             You've successfully signed in! This is your protected dashboard.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           <div className="bg-white rounded-lg shadow-md p-6">
//             <h3 className="text-lg font-semibold text-gray-900 mb-2">
//               Properties
//             </h3>
//             <p className="text-3xl font-bold text-blue-600">0</p>
//             <p className="text-sm text-gray-500 mt-1">Total properties</p>
//           </div>

//           <div className="bg-white rounded-lg shadow-md p-6">
//             <h3 className="text-lg font-semibold text-gray-900 mb-2">
//               Security Deposits
//             </h3>
//             <p className="text-3xl font-bold text-green-600">$0</p>
//             <p className="text-sm text-gray-500 mt-1">Total pooled</p>
//           </div>

//           <div className="bg-white rounded-lg shadow-md p-6">
//             <h3 className="text-lg font-semibold text-gray-900 mb-2">
//               Yield Earned
//             </h3>
//             <p className="text-3xl font-bold text-purple-600">$0</p>
//             <p className="text-sm text-gray-500 mt-1">Total earnings</p>
//           </div>
//         </div>

//         <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
//           <h3 className="text-lg font-semibold text-blue-900 mb-2">
//             🎉 Authentication Working!
//           </h3>
//           <p className="text-blue-800">
//             Nice nice now lets go do something with it!
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }

function DashboardPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const [newRuleAction, setNewRuleAction] = useState<
    "ARCHIVE" | "LABEL" | "DELETE" | "ARCHIVE_AND_LABEL"
  >("ARCHIVE_AND_LABEL");
  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const utils = trpc.useUtils();

  // Fetch user's rules - MUST be called before any conditional returns
  const { data: rules, isLoading: rulesLoading } = trpc.rules.list.useQuery(
    {
      userId: session?.user.id || "",
    },
    {
      enabled: !!session?.user.id, // Only fetch when we have a user ID
    }
  );

  // Create rule mutation
  const createRuleMutation = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      setIsCreatingRule(false);
      setNewRuleName("");
      setNewRuleDescription("");
      setNewRuleLabel("");
    },
  });

  // Generate prompt mutation
  const generatePromptMutation = trpc.rules.generatePrompt.useMutation();

  // Delete rule mutation
  const deleteRuleMutation = trpc.rules.delete.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
    },
  });

  // Toggle rule active/inactive
  const updateRuleMutation = trpc.rules.update.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
    },
  });

  if (isPending) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    navigate({ to: "/login" });
    return null;
  }

  const userId = session.user.id;

  const handleGeneratePrompt = async () => {
    if (!newRuleDescription) return;

    setIsGeneratingPrompt(true);
    try {
      const result = await generatePromptMutation.mutateAsync({
        description: newRuleDescription,
      });

      // Create rule with generated prompt
      await createRuleMutation.mutateAsync({
        userId,
        name: newRuleName || newRuleDescription.slice(0, 50),
        description: newRuleDescription,
        systemPrompt: result.systemPrompt,
        actionType: newRuleAction,
        actionValue:
          newRuleAction === "LABEL" || newRuleAction === "ARCHIVE_AND_LABEL"
            ? newRuleLabel
            : undefined,
        priority: 0,
      });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const getActionBadge = (actionType: string, actionValue?: string | null) => {
    switch (actionType) {
      case "ARCHIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Archive
          </span>
        );
      case "LABEL":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Label: {actionValue}
          </span>
        );
      case "DELETE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Delete
          </span>
        );
      case "ARCHIVE_AND_LABEL":
        return (
          <>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Archive
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Label: {actionValue}
            </span>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Email Rules</h1>
          <p className="mt-2 text-gray-600">
            Manage your AI-powered email filtering rules
          </p>
        </div>

        {/* Create Rule Button */}
        <div className="mb-6">
          <button
            onClick={() => setIsCreatingRule(!isCreatingRule)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create New Rule
          </button>
        </div>

        {/* Create Rule Form */}
        {isCreatingRule && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Rule
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name (optional)
                </label>
                <input
                  type="text"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g., Cold Sales Filter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Description *
                </label>
                <textarea
                  value={newRuleDescription}
                  onChange={(e) => setNewRuleDescription(e.target.value)}
                  placeholder="e.g., Cold sales emails from people I don't know"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Describe in plain English what emails you want to filter
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={newRuleAction}
                  onChange={(e) =>
                    setNewRuleAction(
                      e.target.value as
                        | "ARCHIVE"
                        | "LABEL"
                        | "DELETE"
                        | "ARCHIVE_AND_LABEL"
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ARCHIVE">Archive</option>
                  <option value="LABEL">Add Label</option>
                  <option value="ARCHIVE_AND_LABEL">Archive and Label</option>
                  <option value="DELETE">Delete</option>
                </select>
              </div>

              {(newRuleAction === "LABEL" ||
                newRuleAction === "ARCHIVE_AND_LABEL") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label Name *
                  </label>
                  <input
                    type="text"
                    value={newRuleLabel}
                    onChange={(e) => setNewRuleLabel(e.target.value)}
                    placeholder="e.g., Cold Sales"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleGeneratePrompt}
                  disabled={
                    !newRuleDescription ||
                    isGeneratingPrompt ||
                    createRuleMutation.isPending
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isGeneratingPrompt || createRuleMutation.isPending
                    ? "Creating..."
                    : "Create Rule"}
                </button>
                <button
                  onClick={() => setIsCreatingRule(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="space-y-4">
          {rulesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading rules...</p>
            </div>
          ) : rules && rules.length > 0 ? (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white rounded-lg shadow-md p-6 border ${
                  rule.isActive
                    ? "border-gray-200"
                    : "border-gray-300 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {rule.name}
                      </h3>
                      {!rule.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-gray-600 mb-3">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      {getActionBadge(rule.actionType, rule.actionValue)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() =>
                        updateRuleMutation.mutate({
                          id: rule.id,
                          isActive: !rule.isActive,
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                        rule.isActive
                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {rule.isActive ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No rules yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first email filtering rule.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setIsCreatingRule(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Your First Rule
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

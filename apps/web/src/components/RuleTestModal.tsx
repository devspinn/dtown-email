import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { decodeHtml } from "@/lib/utils";

interface RuleTestModalProps {
  ruleId: string;
  ruleName: string;
  onClose: () => void;
}

export function RuleTestModal({
  ruleId,
  ruleName,
  onClose,
}: RuleTestModalProps) {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"testing" | "review" | "applying">(
    "testing"
  );

  // Test the rule
  const testMutation = trpc.rules.test.useMutation({
    onSuccess: (data) => {
      // Auto-select all matched emails
      const matchedIds = data.results
        .filter((result) => result.matched)
        .map((result) => result.email.id);
      setSelectedEmails(new Set(matchedIds));
      setStep("review");
    },
  });

  // Apply to selected emails
  const applyMutation = trpc.rules.applyToEmails.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  // Start testing when modal opens
  useEffect(() => {
    console.log("(modal) Starting rule test for ruleId:", ruleId);
    testMutation.mutate({ ruleId, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleId]); // testMutation.mutate is stable but ESLint doesn't recognize it

  const toggleEmail = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleApply = () => {
    setStep("applying");
    applyMutation.mutate({
      ruleId,
      emailIds: Array.from(selectedEmails),
    });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  console.log("(modal) Rendering with step:", step);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Test Rule</h2>
              <p className="text-sm text-gray-600 mt-1">{ruleName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Testing State */}
          {step === "testing" && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Testing rule against your recent emails...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This may take a few moments
              </p>
            </div>
          )}

          {/* Review State */}
          {step === "review" && testMutation.data && (
            <>
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-blue-600 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">
                      Found {testMutation.data.matchCount} matching emails out
                      of {testMutation.data.total} tested
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      {testMutation.data.matchCount > 0
                        ? "Matches are highlighted in green and pre-selected. You can select or deselect any emails to apply the rule to."
                        : "No strong matches found. You can still select emails to apply the rule manually."}
                    </p>
                  </div>
                </div>
              </div>

              {/* All Results List */}
              <div className="space-y-3">
                {testMutation.data.results.map((result) => {
                  const isMatch = result.matched;
                  const isSelected = selectedEmails.has(result.email.id);
                  const hasError = result.error;

                  return (
                    <div
                      key={result.email.id}
                      className={`border rounded-lg p-4 transition-all cursor-pointer ${
                        hasError
                          ? "border-red-200 bg-red-50"
                          : isMatch
                            ? isSelected
                              ? "border-green-500 bg-green-50"
                              : "border-green-300 bg-green-50 hover:border-green-400"
                            : isSelected
                              ? "border-gray-400 bg-gray-100"
                              : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      }`}
                      onClick={() => !hasError && toggleEmail(result.email.id)}
                    >
                      <div className="flex items-start gap-3">
                        {!hasError && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEmail(result.email.id)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {result.email.from}
                              </p>
                              <p className="text-sm text-gray-700 font-medium mt-1 truncate">
                                {result.email.subject}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {hasError ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Error
                                </span>
                              ) : isMatch ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">
                                  {result.confidence}% confidence
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-300 text-gray-700">
                                  {result.confidence}% confidence
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {formatDate(result.email.receivedAt)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {decodeHtml(result.email.snippet)}
                          </p>
                          {result.reasoning && (
                            <p className="text-xs text-gray-600 mt-2 italic">
                              💡 {result.reasoning}
                            </p>
                          )}
                          {hasError && (
                            <p className="text-xs text-red-600 mt-2">
                              ❌ {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Applying State */}
          {step === "applying" && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Applying actions to {selectedEmails.size} email
                {selectedEmails.size !== 1 ? "s" : ""}...
              </p>
            </div>
          )}

          {/* Error State */}
          {testMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error testing rule</p>
              <p className="text-sm text-red-600 mt-1">
                {testMutation.error.message}
              </p>
            </div>
          )}

          {applyMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <p className="text-red-800 font-medium">Error applying actions</p>
              <p className="text-sm text-red-600 mt-1">
                {applyMutation.error.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && testMutation.data && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedEmails.size} of {testMutation.data.total} email
                {selectedEmails.size !== 1 ? "s" : ""} selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={
                    selectedEmails.size === 0 || applyMutation.isPending
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Apply to Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

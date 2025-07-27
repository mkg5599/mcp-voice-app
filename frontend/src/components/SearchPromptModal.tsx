"use client";
import { useState } from "react";

type Props = {
    onSelect: (prompt: string) => void;
};

const PREDEFINED: string[] = [
    "Show me all products",
    "Show me products priced under 30",
    "Show me red items under 50",
    "List products available in Portland",
    "Find blue products in Seattle",
    "comfortable hoodies for streetwear",
    "warm winter clothing for cold weather",
    "athletic gear for running and fitness",
    "casual summer outfits and accessories",
    "premium leather accessories and bags",
    "cozy fleece items for lounging",
    "breathable fabrics for hot weather",
    "durable outdoor hiking gear",
];

export default function SearchPromptModal({ onSelect }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg"
                onClick={() => setOpen(true)}
            >
                ✨ Prompt Ideas
            </button>

            {open && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
                    <div className="w-96 max-h-[80vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl border border-gray-200">
                        <h3 className="mb-4 text-xl font-bold text-gray-800">Try one of these searches</h3>
                        <div className="mb-4">
                            <h4 className="text-sm font-semibold text-blue-600 mb-2">🔍 Attribute Search</h4>
                            <p className="text-xs text-gray-500 mb-3">Filter by specific attributes like color, price, city</p>
                            <ul className="space-y-2 mb-4">
                                {PREDEFINED.slice(0, 5).map((p) => (
                                    <li key={p}>
                                        <button
                                            className="w-full rounded-md bg-blue-50 px-3 py-2 text-left text-gray-800 hover:bg-blue-100 transition-colors text-sm"
                                            onClick={() => {
                                                onSelect(p);
                                                setOpen(false);
                                            }}
                                        >
                                            {p}
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <h4 className="text-sm font-semibold text-purple-600 mb-2">🤖 Semantic Search</h4>
                            <p className="text-xs text-gray-500 mb-3">Natural language queries using AI understanding</p>
                            <ul className="space-y-2">
                                {PREDEFINED.slice(5).map((p) => (
                                    <li key={p}>
                                        <button
                                            className="w-full rounded-md bg-purple-50 px-3 py-2 text-left text-gray-800 hover:bg-purple-100 transition-colors text-sm"
                                            onClick={() => {
                                                onSelect(p);
                                                setOpen(false);
                                            }}
                                        >
                                            {p}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">💡 Pro Tips:</h5>
                            <ul className="text-xs text-gray-600 space-y-1">
                                <li>• Use descriptive words for better semantic search results</li>
                                <li>• Try voice input for natural conversation</li>
                                <li>• Combine attributes: &quot;comfortable red hoodies under $40&quot;</li>
                            </ul>
                        </div>

                        <button
                            className="w-full rounded-md border border-gray-300 px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors font-medium"
                            onClick={() => setOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
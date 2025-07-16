"use client";
import { useState } from "react";

type Props = {
    onSelect: (prompt: string) => void;
};

const PREDEFINED: string[] = [
    "Show me all products",
    "Show me products priced 1-20",
    "Show me red jackets under 50",
    "List products available in London",
    "Find blue shoes in New York under 100",
];

export default function SearchPromptModal({ onSelect }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                className="rounded-lg bg-indigo-200 px-3 py-2 text-black hover:bg-indigo-300"
                onClick={() => setOpen(true)}
            >
                Prompt ideas
            </button>

            {open && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
                    <div className="w-80 rounded-xl bg-white p-4 shadow-xl">
                        <h3 className="mb-2 text-lg font-semibold text-black">Try one of these</h3>
                        <ul className="space-y-2">
                            {PREDEFINED.map((p) => (
                                <li key={p}>
                                    <button
                                        className="w-full rounded-md bg-gray-100 px-3 py-2 text-left text-black hover:bg-indigo-50"
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

                        <button
                            className="mt-4 w-full rounded-md border px-3 py-2 bg-red-800 text-white hover:bg-red-700"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
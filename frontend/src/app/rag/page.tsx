"use client";

import { useState } from "react";
import { Product } from "../../types/product";
import RagChat from "../../components/RagChat";
import Link from "next/link";
import { ArrowLeft, Bot, Sparkles } from "lucide-react";

const formatPrice = (p: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p);

const ProductCard = ({ product }: { product: Product }) => (
  <div className="bg-white rounded-lg border shadow-md p-4 hover:shadow-lg transition-shadow">
    <div className="mb-3 flex items-start justify-between">
      <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
      <div className="flex flex-col items-end gap-2">
        <span className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-sm font-semibold text-white">
          {formatPrice(product.price)}
        </span>
        {product.similarity_score && (
          <span className="rounded-full bg-green-100 text-green-700 px-2 py-1 text-xs font-medium">
            {Math.round(product.similarity_score * 100)}% match
          </span>
        )}
      </div>
    </div>
    
    {product.description && (
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
    )}
    
    <div className="space-y-2 text-sm text-gray-600">
      <p>
        <span className="font-semibold text-gray-700">City:</span> {product.city}
      </p>
      <div className="flex items-center">
        <span className="mr-2 font-semibold text-gray-700">Colors:</span>
        <div className="flex gap-2">
          {product.colors.map((c) => (
            <span
              key={c}
              className="h-5 w-5 rounded-full border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
      {product.tags && product.tags.length > 0 && (
        <div className="flex items-center flex-wrap gap-1 mt-2">
          <span className="text-xs font-semibold text-gray-700">Tags:</span>
          {product.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
          {product.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{product.tags.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  </div>
);

export default function RagPage() {
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);

  const handleProductsFound = (products: Product[]) => {
    setDisplayedProducts(products);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-lg border-b border-indigo-100">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">Back to Search</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI Product Assistant
                </h1>
                <p className="text-sm text-gray-600">Conversational RAG-powered product discovery</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Link
              href="/about"
              className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
            >
              About
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-center py-8 px-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
          Chat with Your Product Catalog
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-4">
          Have natural conversations about products. Ask for recommendations, compare items, 
          get detailed information, and discover products through AI-powered assistance.
        </p>
        <div className="flex justify-center items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <span>Retrieval-Augmented Generation</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>OpenAI GPT + Vector Search</span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-4">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Chat Interface */}
          <div className="order-1 lg:order-1">
            <RagChat onProductsFound={handleProductsFound} />
          </div>

          {/* Products Display */}
          <div className="order-2 lg:order-2">
            {displayedProducts.length > 0 ? (
              <div className="space-y-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Recommended Products ({displayedProducts.length})
                  </h3>
                  <p className="text-sm text-gray-600">
                    Products found by AI based on your conversation
                  </p>
                </div>
                
                <div className="grid gap-4">
                  {displayedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-8 text-center">
                <Bot className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Start a Conversation
                </h3>
                <p className="text-gray-600 mb-4">
                  Ask the AI assistant about products and relevant items will appear here.
                </p>
                <div className="text-sm text-gray-500">
                  <p>Try asking:</p>
                  <ul className="mt-2 space-y-1">
                    <li>• `What hoodies do you have?`</li>
                    <li>• `I need winter gear for hiking`</li>
                    <li>• `Show me your red products under $40`</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Info Section */}
      <section className="container mx-auto px-6 py-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            How RAG Works Here
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h4 className="font-semibold text-gray-700 mb-2">Understand</h4>
              <p className="text-gray-600">
                AI analyzes your question and extracts intent, preferences, and requirements.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-bold">2</span>
              </div>
              <h4 className="font-semibold text-gray-700 mb-2">Retrieve</h4>
              <p className="text-gray-600">
                Searches vector database for most relevant products using semantic similarity.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-bold">3</span>
              </div>
              <h4 className="font-semibold text-gray-700 mb-2">Generate</h4>
              <p className="text-gray-600">
                Creates personalized response with product recommendations and explanations.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
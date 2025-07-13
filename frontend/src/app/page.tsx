'use client';

import { useState, useEffect, useRef } from 'react';

interface Product {
  id: number;
  name: string;
  colors: string[];
  price: number;
  city: string;
}

// Helper function to format price
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
};

// ProductCard component
const ProductCard = ({ product }: { product: Product }) => (
  <div className="border rounded-lg p-4 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md">
    <div className="flex justify-between items-start mb-2">
      <h3 className="font-bold text-lg text-gray-800">{product.name}</h3>
      <span className="font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full text-sm">{formatPrice(product.price)}</span>
    </div>
    <div className="text-sm text-gray-600 space-y-1">
      <p><span className="font-semibold">City:</span> {product.city}</p>
      <div className="flex items-center">
        <span className="font-semibold mr-2">Colors:</span>
        <div className="flex gap-2">
          {product.colors.map(color => (
            <span key={color} className="w-5 h-5 rounded-full border border-gray-300" style={{ backgroundColor: color }} title={color}></span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Main component
export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'list all products' }), // Initial prompt to LLM
        });
        const chatData = await response.json();
        if (response.ok) {
          try {
            const productsFromLLM = JSON.parse(chatData.response);
            if (Array.isArray(productsFromLLM)) {
              setProducts(productsFromLLM);
            }
          } catch (error: unknown) {
            console.log("Initial LLM message:", chatData.response, error instanceof Error ? error.message : error);
            setProducts([]); // No products if LLM returns a message
          }
        } else {
          console.error('Initial chat error:', chatData.error);
          setProducts([]);
        }
      } catch (error) {
        console.error('Error fetching initial products:', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleMicClick = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start();

          const audioChunks: Blob[] = [];
          mediaRecorder.addEventListener("dataavailable", (event: BlobEvent) => {
            audioChunks.push(event.data);
          });

          mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks);
            sendAudioToServer(audioBlob);
          });

          setIsRecording(true);
        });
    }
  };

  const sendAudioToServer = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        console.log('Transcription:', data.text);
        // Send transcribed text to backend for LLM processing
        const chatResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: data.text }),
        });
        const chatData = await chatResponse.json();
        if (chatResponse.ok) {
          console.log('Chat Response:', chatData.response);
          // Assuming chatData.response contains the filtered products or a message
          // For now, let's just log it. In a real app, you'd parse and update products.
          // If the LLM returns a tool call result, it will be a JSON string of products.
          try {
            const productsFromLLM = JSON.parse(chatData.response);
            if (Array.isArray(productsFromLLM)) {
              setProducts(productsFromLLM);
            }
          } catch (_error: unknown) {
            // If it's not JSON, it's likely a message from the LLM
            console.log("LLM message:", chatData.response, _error instanceof Error ? _error.message : _error);
            // You might want to display this message to the user
          }
        } else {
          console.error('Chat error:', chatData.error);
        }
      } else {
        console.error('Transcription error:', data.error);
      }
    } catch (error: unknown) {
      console.error('Error sending audio to server:', error instanceof Error ? error.message : error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
            <div className="w-full max-w-md flex items-center">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleMicClick}
                className={`px-4 py-2 border border-gray-300 rounded-r-md ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'} hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                🎤
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="text-center text-gray-500">
            <p>Loading products...</p>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <p>No products found.</p>
          </div>
        )}
      </main>
    </div>
  );
}
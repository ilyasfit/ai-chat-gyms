export default function TestEmbedPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Welcome to Our Landing Page
        </h1>
        <p className="text-xl text-gray-600">
          This page demonstrates a fixed chat widget embedded via an iframe.
        </p>
      </header>

      <main className="max-w-4xl mx-auto">
        <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">
            About Us
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </section>

        <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">
            Our Services
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Service One: Offering comprehensive solutions.</li>
            <li>Service Two: Dedicated support and maintenance.</li>
            <li>Service Three: Innovative approaches to modern problems.</li>
          </ul>
        </section>

        <section className="p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">
            Contact Information
          </h2>
          <p className="text-gray-600">
            Get in touch with us through the chat widget!
          </p>
        </section>
      </main>

      {/* The iframe is now styled to be fixed in the bottom right corner */}
      <iframe
        src="/embed/chat"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "400px", // Approximate width of the chat component
          height: "600px", // Approximate height of the chat component
          border: "none",
          borderRadius: "8px", // Optional: for rounded corners on the iframe itself
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)", // Optional: for a bit of shadow
          zIndex: 1000, // Ensure it's above other content
        }}
        title="Embedded Chat"
      />
    </div>
  );
}

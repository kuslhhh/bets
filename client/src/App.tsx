// Backend-first placeholder. Real UI is built in the frontend phase,
// after all backend APIs and Postman tests pass (PROJECT.md §22).
export default function App() {
  return (
    <main>
      <h1>Finance Assessment</h1>
      <p>Backend only for now. API: {import.meta.env.VITE_API_URL}</p>
    </main>
  );
}

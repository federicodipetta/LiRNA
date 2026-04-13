import { ParserWorkbench } from "./features/parser/components/parser-workbench";

function App() {
  return (
    <main className="relative isolate overflow-hidden px-4 py-12 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute left-[-80px] top-[-80px] h-64 w-64 rounded-full bg-coral/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sea/30 blur-3xl" />
      <ParserWorkbench />
    </main>
  );
}

export default App;

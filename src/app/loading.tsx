export default function Loading() {
  return (
    <div className="animate-pulse pt-8" aria-busy="true" aria-label="Loading">
      <div className="mx-auto h-3 w-32 bg-rule-soft" />
      <div className="mx-auto mt-4 h-10 w-48 bg-rule-soft" />
      <div className="mt-10 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="index-card h-32" />
        ))}
      </div>
    </div>
  );
}

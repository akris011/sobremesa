import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="pt-16">
      <EmptyState title="This page isn't in the book" action={<Link href="/" className="btn btn-primary">Back to the cookbook</Link>}>
        It may have been removed, or it belongs to someone else&rsquo;s cookbook.
      </EmptyState>
    </main>
  );
}

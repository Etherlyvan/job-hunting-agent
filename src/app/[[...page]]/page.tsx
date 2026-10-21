import { Workspace } from "../../components/workspace";
import Link from "next/link";
const pages = new Set([
  "",
  "profile",
  "jobs",
  "cv",
  "letters",
  "tracker",
  "interview",
  "career",
  "settings",
]);
export default async function Page({
  params,
}: {
  params: Promise<{ page?: string[] }>;
}) {
  const { page = [] } = await params;
  const section = page[0] ?? "";
  if (!pages.has(section))
    return (
      <main>
        <h1>Page not found</h1>
        <Link href="/">Return to dashboard</Link>
      </main>
    );
  return (
    <Workspace
      section={section}
      jobId={section === "jobs" ? page[1] : undefined}
    />
  );
}

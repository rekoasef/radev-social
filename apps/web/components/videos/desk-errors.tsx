/** Why a change at a desk was not accepted. */
export function DeskErrors({ messages }: { messages: string[] }) {
  return (
    <ul role="alert" className="mt-2 flex flex-col gap-1 border-l border-tally-red pl-3 text-sm">
      {messages.map((message) => (
        <li key={message} className="text-ink">
          {message}
        </li>
      ))}
    </ul>
  );
}

import type { Credit } from "./credits";

export function CreditLine({ credit }: { credit: Credit }) {
  return (
    <>
      <a href={credit.href} target="_blank" rel="noreferrer">
        “{credit.work}”
      </a>{" "}
      {credit.license ? `© copyright ${credit.author}` : `by ${credit.author}`}
      {credit.license && (
        <>
          ,{" "}
          <a href={credit.license.href} target="_blank" rel="noreferrer">
            {credit.license.name}
          </a>
        </>
      )}
      {credit.host && (
        <>
          . File hosted by{" "}
          <a href={credit.host.href} target="_blank" rel="noreferrer">
            {credit.host.name}
          </a>
        </>
      )}
      .
    </>
  );
}

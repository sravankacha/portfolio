"use client";

import { useEffect, useState } from "react";
import { profile } from "../_data/profile";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

export default function EmailLink({ className, children }: Props) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(true);
  }, []);

  const display = revealed
    ? `${profile.emailUser}@${profile.emailDomain}`
    : `${profile.emailUser} [at] ${profile.emailDomain}`;

  const href = revealed ? `mailto:${profile.emailUser}@${profile.emailDomain}` : "#";

  return (
    <a
      href={href}
      className={className}
      rel="nofollow noopener"
      onClick={(e) => {
        if (!revealed) e.preventDefault();
      }}
    >
      {children ?? display}
    </a>
  );
}

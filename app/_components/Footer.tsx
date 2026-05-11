import { profile } from "../_data/profile";
import EmailLink from "./EmailLink";
import ThemeSwitcher from "./ThemeSwitcher";
import { OceanFishSchool } from "./OceanBackdrop";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border mt-24 relative overflow-hidden">
      <OceanFishSchool />
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-4 relative z-10">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-muted">
          <p>© {year} {profile.name}</p>
          <ul className="flex gap-4">
            <li>
              <EmailLink>Email</EmailLink>
            </li>
            <li>
              <a
                href={profile.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href={profile.github}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
        <ThemeSwitcher />
      </div>
    </footer>
  );
}

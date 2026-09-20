import { useTheme } from "./ThemeProvider";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <label className="theme-picker">
      Theme
      <select
        value={theme}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "light" || value === "dark" || value === "system")
            setTheme(value);
        }}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}

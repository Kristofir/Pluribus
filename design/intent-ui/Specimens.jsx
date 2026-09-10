import React from "react";
import { createRoot } from "react-dom/client";
import { parseDate, Time } from "@internationalized/date";
import {
  PlusIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  HomeIcon,
  Cog6ToothIcon,
} from "@heroicons/react/20/solid";
import { toast } from "sonner";
import { ThemeProvider } from "../../apps/frontend/src/components/ThemeProvider";
import "../../apps/frontend/src/Styles.css";

const modules = import.meta.glob(
  "../../apps/frontend/src/components/ui/*.tsx",
  {
    eager: true,
  },
);
const U = Object.assign({}, ...Object.values(modules));
const fixtures = {};
const selectedFamily = new URLSearchParams(location.search).get("family");
const add = (family, props, node, width) =>
  (fixtures[family] ??= []).push({ props, node, width });
const states = ["Default", "Disabled"];
const field = (node, state = "Default", value = "") => (
  <U.TextField
    aria-label="Example"
    isDisabled={state === "Disabled"}
    isInvalid={state === "Invalid"}
    defaultValue={value}
  >
    {node}
  </U.TextField>
);

for (const size of [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
])
  for (const shape of ["Circle", "Square"])
    add(
      "Avatar",
      { Size: size, Shape: shape },
      <U.Avatar
        size={size}
        isSquare={shape === "Square"}
        initials="CH"
        alt="Chris"
      />,
    );
for (const intent of [
  "primary",
  "secondary",
  "success",
  "info",
  "warning",
  "danger",
  "outline",
])
  for (const circle of [true, false])
    add(
      "Badge",
      { Intent: intent, Shape: circle ? "Pill" : "Rounded" },
      <U.Badge intent={intent} isCircle={circle}>
        Badge
      </U.Badge>,
    );
for (const variant of ["spin", "ring"])
  add("Loader", { Variant: variant }, <U.Loader variant={variant} />);
for (const intent of [
  "primary",
  "secondary",
  "warning",
  "danger",
  "success",
  "outline",
  "plain",
])
  for (const size of [
    "xs",
    "sm",
    "md",
    "lg",
    "sq-xs",
    "sq-sm",
    "sq-md",
    "sq-lg",
  ])
    for (const state of states)
      add(
        "Button/" + intent,
        { Size: size, State: state },
        <U.Button
          intent={intent}
          size={size}
          isDisabled={state === "Disabled"}
          aria-label="Add"
        >
          {size.startsWith("sq") ? <PlusIcon /> : "Button"}
        </U.Button>,
      );
for (const state of [
  "Default",
  "Selected",
  "Indeterminate",
  "Invalid",
  "Disabled",
])
  add(
    "Checkbox",
    { State: state },
    <U.CheckboxField
      isSelected={state === "Selected"}
      isIndeterminate={state === "Indeterminate"}
      isInvalid={state === "Invalid"}
      isDisabled={state === "Disabled"}
    >
      <U.Checkbox>Remember me</U.Checkbox>
    </U.CheckboxField>,
  );
for (const state of ["Default", "Selected", "Invalid", "Disabled"])
  add(
    "Radio",
    { State: state },
    <U.RadioGroup
      aria-label="Plan"
      defaultValue={state === "Selected" ? "one" : undefined}
      isInvalid={state === "Invalid"}
      isDisabled={state === "Disabled"}
    >
      <U.RadioField value="one">
        <U.Radio>Personal</U.Radio>
      </U.RadioField>
    </U.RadioGroup>,
  );
for (const selected of [false, true])
  for (const state of states)
    add(
      "Switch",
      { Selected: String(selected), State: state },
      <U.SwitchField isSelected={selected} isDisabled={state === "Disabled"}>
        <U.Switch>Email updates</U.Switch>
      </U.SwitchField>,
    );
for (const intent of ["plain", "outline"])
  for (const size of ["xs", "sm", "md", "lg"])
    for (const selected of [false, true])
      add(
        "Toggle/" + intent,
        { Size: size, Selected: String(selected) },
        <U.Toggle intent={intent} size={size} isSelected={selected}>
          Bold
        </U.Toggle>,
      );
for (const state of ["Default", "Filled", "Invalid", "Disabled"]) {
  add(
    "Input",
    { State: state },
    field(
      <U.Input placeholder="Enter a value" />,
      state,
      state === "Filled" ? "Example value" : "",
    ),
    320,
  );
  add(
    "Textarea",
    { State: state },
    field(
      <U.Textarea placeholder="Write a description" />,
      state,
      state === "Filled" ? "A short description." : "",
    ),
    320,
  );
  add(
    "Text Field",
    { State: state },
    <U.TextField
      isDisabled={state === "Disabled"}
      isInvalid={state === "Invalid"}
      defaultValue={state === "Filled" ? "Chris" : ""}
    >
      <U.Label>Name</U.Label>
      <U.Input placeholder="Your name" />
      {state === "Invalid" ? (
        <U.FieldError>Please enter your name.</U.FieldError>
      ) : (
        <U.Description>How should we address you?</U.Description>
      )}
    </U.TextField>,
    320,
  );
}
add(
  "Field",
  { Part: "Label" },
  <U.Label elementType="span">Field label</U.Label>,
);
add(
  "Field",
  { Part: "Description" },
  <U.Description>Helpful supporting text.</U.Description>,
);
add(
  "Search Field",
  { State: "Empty" },
  <U.SearchField>
    <U.Label>Search</U.Label>
    <U.SearchInput placeholder="Search components" />
  </U.SearchField>,
  320,
);
add(
  "Search Field",
  { State: "Filled" },
  <U.SearchField defaultValue="Button">
    <U.Label>Search</U.Label>
    <U.SearchInput />
  </U.SearchField>,
  320,
);
for (const disabled of [false, true])
  add(
    "Number Field",
    { State: disabled ? "Disabled" : "Default" },
    <U.NumberField defaultValue={3} isDisabled={disabled}>
      <U.Label>Quantity</U.Label>
      <U.NumberInput />
    </U.NumberField>,
    320,
  );
add(
  "Date Field",
  { State: "Filled" },
  <U.DateField defaultValue={parseDate("2026-09-03")}>
    <U.Label>Date</U.Label>
    <U.DateInput />
  </U.DateField>,
);
add(
  "Time Field",
  { State: "Filled" },
  <U.TimeField defaultValue={new Time(9, 30)}>
    <U.Label>Time</U.Label>
    <U.TimeInput />
  </U.TimeField>,
);
add(
  "Color Field",
  { State: "Filled" },
  <U.ColorField defaultValue="#155dfc">
    <U.Label>Color</U.Label>
    <U.Input />
  </U.ColorField>,
  220,
);
for (const disabled of [false, true])
  add(
    "Native Select",
    { State: disabled ? "Disabled" : "Default" },
    <U.NativeSelect>
      <U.Label htmlFor={"native-" + disabled}>Framework</U.Label>
      <U.NativeSelectContent id={"native-" + disabled} disabled={disabled}>
        <option>React</option>
        <option>Vue</option>
      </U.NativeSelectContent>
    </U.NativeSelect>,
    320,
  );
add(
  "Select",
  { State: "Selected" },
  <U.Select defaultSelectedKey="react">
    <U.Label>Framework</U.Label>
    <U.SelectTrigger />
    <U.SelectContent>
      <U.SelectItem id="react">React</U.SelectItem>
      <U.SelectItem id="vue">Vue</U.SelectItem>
    </U.SelectContent>
  </U.Select>,
  320,
);
add(
  "Combo Box",
  { State: "Empty" },
  <U.ComboBox>
    <U.Label>Framework</U.Label>
    <U.ComboBoxInput placeholder="Search frameworks" />
    <U.ComboBoxContent>
      <U.ComboBoxItem id="react">React</U.ComboBoxItem>
      <U.ComboBoxItem id="vue">Vue</U.ComboBoxItem>
    </U.ComboBoxContent>
  </U.ComboBox>,
  320,
);
add(
  "Tag Group",
  { State: "Removable" },
  <U.TagGroup aria-label="Technologies" onRemove={() => {}}>
    <U.TagList>
      <U.Tag id="react">React</U.Tag>
      <U.Tag id="aria">React Aria</U.Tag>
      <U.Tag id="tailwind">Tailwind</U.Tag>
    </U.TagList>
  </U.TagGroup>,
);
add(
  "Tag Field",
  { State: "Filled" },
  <U.TagField defaultValue={["React", "TypeScript"]}>
    <U.Label>Tags</U.Label>
    <U.Input placeholder="Add a tag" />
  </U.TagField>,
  320,
);
for (const value of [25, 65, 90])
  add(
    "Meter",
    { Value: String(value) },
    <U.Meter value={value}>
      <U.MeterHeader>
        <U.Label>Storage used</U.Label>
        <U.MeterValue />
      </U.MeterHeader>
      <U.MeterTrack />
    </U.Meter>,
    320,
  );
for (const value of [0, 50, 100])
  add(
    "Progress Bar",
    { Value: String(value) },
    <U.ProgressBar value={value}>
      <U.ProgressBarHeader>
        <U.Label>Upload</U.Label>
        <U.ProgressBarValue />
      </U.ProgressBarHeader>
      <U.ProgressBarTrack />
    </U.ProgressBar>,
    320,
  );
for (const value of [25, 50, 100])
  add(
    "Progress Circle",
    { Value: String(value) },
    <U.ProgressCircle value={value} aria-label="Progress" />,
  );
for (const disabled of [false, true])
  add(
    "Slider",
    { State: disabled ? "Disabled" : "Default" },
    <U.Slider defaultValue={50} isDisabled={disabled}>
      <U.Label>Volume</U.Label>
      <U.SliderOutput />
      <U.SliderTrack />
    </U.Slider>,
    320,
  );
for (const intent of ["default", "info", "warning", "danger", "success"])
  add(
    "Note",
    { Intent: intent },
    <U.Note intent={intent}>A useful message with additional context.</U.Note>,
    420,
  );
add(
  "Card",
  { Variant: "Default" },
  <U.Card>
    <U.CardHeader>
      <U.CardTitle>Project settings</U.CardTitle>
      <U.CardDescription>Manage the basics for your project.</U.CardDescription>
    </U.CardHeader>
    <U.CardContent>
      <U.Text>Keep everything in one place.</U.Text>
    </U.CardContent>
    <U.CardFooter>
      <U.Button>Save changes</U.Button>
    </U.CardFooter>
  </U.Card>,
  400,
);
add(
  "Calendar",
  { Selection: "Single" },
  <U.Calendar aria-label="Date" defaultValue={parseDate("2026-09-03")} />,
);
add(
  "Range Calendar",
  { Selection: "Range" },
  <U.RangeCalendar
    aria-label="Date range"
    defaultValue={{
      start: parseDate("2026-09-03"),
      end: parseDate("2026-09-08"),
    }}
  />,
);
for (const separator of ["chevron", "slash"])
  add(
    "Breadcrumbs",
    { Separator: separator },
    <U.Breadcrumbs separator={separator}>
      <U.BreadcrumbsItem href="#">Home</U.BreadcrumbsItem>
      <U.BreadcrumbsItem href="#">Projects</U.BreadcrumbsItem>
      <U.BreadcrumbsItem>Settings</U.BreadcrumbsItem>
    </U.Breadcrumbs>,
  );
add(
  "List Box",
  { Selection: "Single" },
  <U.ListBox
    aria-label="Framework"
    selectionMode="single"
    defaultSelectedKeys={["react"]}
  >
    <U.ListBoxItem id="react">React</U.ListBoxItem>
    <U.ListBoxItem id="vue">Vue</U.ListBoxItem>
    <U.ListBoxItem id="svelte">Svelte</U.ListBoxItem>
  </U.ListBox>,
  320,
);
add(
  "Grid List",
  { Selection: "Multiple" },
  <U.GridList
    aria-label="Team"
    selectionMode="multiple"
    defaultSelectedKeys={["chris"]}
  >
    <U.GridListItem id="chris" textValue="Chris">
      <U.Avatar initials="CH" />
      <U.GridListLabel>Chris</U.GridListLabel>
    </U.GridListItem>
    <U.GridListItem id="alex" textValue="Alex">
      <U.Avatar initials="AL" />
      <U.GridListLabel>Alex</U.GridListLabel>
    </U.GridListItem>
  </U.GridList>,
  320,
);
add(
  "Choice Box",
  { Layout: "Stack" },
  <U.ChoiceBox aria-label="Plan" defaultSelectedKeys={["personal"]}>
    <U.ChoiceBoxItem
      id="personal"
      label="Personal"
      description="For individual projects."
      textValue="Personal"
    />
    <U.ChoiceBoxItem
      id="team"
      label="Team"
      description="Build together."
      textValue="Team"
    />
  </U.ChoiceBox>,
  360,
);
add(
  "Disclosure Group",
  { State: "Expanded" },
  <U.DisclosureGroup defaultExpandedKeys={["one"]}>
    <U.Disclosure id="one">
      <U.DisclosureTrigger>What is Intent UI?</U.DisclosureTrigger>
      <U.DisclosurePanel>
        Accessible React components that you own.
      </U.DisclosurePanel>
    </U.Disclosure>
    <U.Disclosure id="two">
      <U.DisclosureTrigger>Can I customize it?</U.DisclosureTrigger>
      <U.DisclosurePanel>Yes.</U.DisclosurePanel>
    </U.Disclosure>
  </U.DisclosureGroup>,
  400,
);
for (const level of [1, 2, 3, 4])
  add(
    "Heading",
    { Level: String(level) },
    <U.Heading level={level}>Heading level {level}</U.Heading>,
  );
add("Text", { Style: "Body" }, <U.Text>Supporting interface text.</U.Text>);
add("Text", { Style: "Strong" }, <U.Strong>Emphasized text</U.Strong>);
add("Text", { Style: "Code" }, <U.Code>npm run dev</U.Code>);
add("Link", { State: "Default" }, <U.Link href="#">Read documentation</U.Link>);
add("Keyboard", { Variant: "Shortcut" }, <U.Keyboard>⌘ K</U.Keyboard>);
add("Separator", { Orientation: "Horizontal" }, <U.Separator />, 320);
add(
  "Skeleton",
  { Variant: "Text" },
  <U.Skeleton isLoading>
    <div>
      <div>
        <span className="block h-5 w-64">Loading content</span>
      </div>
    </div>
  </U.Skeleton>,
);
add(
  "Skeleton",
  { Variant: "Avatar" },
  <U.Skeleton isLoading>
    <U.Avatar size="lg" />
  </U.Skeleton>,
);
add(
  "Show More",
  { Variant: "Button" },
  <U.ShowMore>Show more</U.ShowMore>,
  320,
);
add(
  "Description List",
  { Variant: "Default" },
  <U.DescriptionList>
    <U.DescriptionTerm>Project</U.DescriptionTerm>
    <U.DescriptionDetails>ConvexHackathon</U.DescriptionDetails>
    <U.DescriptionTerm>Status</U.DescriptionTerm>
    <U.DescriptionDetails>Active</U.DescriptionDetails>
  </U.DescriptionList>,
  400,
);
add(
  "Button Group",
  { Orientation: "Horizontal" },
  <U.ButtonGroup>
    <U.Button intent="outline">Day</U.Button>
    <U.Button intent="outline">Week</U.Button>
    <U.Button intent="outline">Month</U.Button>
  </U.ButtonGroup>,
);
add(
  "Toggle Group",
  { Selection: "Single" },
  <U.ToggleGroup selectionMode="single" defaultSelectedKeys={["week"]}>
    <U.ToggleGroupItem id="day">Day</U.ToggleGroupItem>
    <U.ToggleGroupItem id="week">Week</U.ToggleGroupItem>
    <U.ToggleGroupItem id="month">Month</U.ToggleGroupItem>
  </U.ToggleGroup>,
);
add(
  "Tracker",
  { Variant: "Status" },
  <U.Tracker
    disabledTooltip
    data={Array.from({ length: 24 }, (_, i) => ({
      color: i === 17 ? "bg-warning" : i === 18 ? "bg-danger" : "bg-success",
    }))}
  />,
  400,
);
add(
  "Bar List",
  { Variant: "Default" },
  <U.BarList
    data={[
      { name: "React", value: 120 },
      { name: "Vue", value: 80 },
      { name: "Svelte", value: 45 },
    ]}
  />,
  400,
);
add(
  "Leaderboard",
  { Variant: "Default" },
  <U.Leaderboard>
    <U.LeaderboardHeader>
      <U.LeaderboardTitle>Top frameworks</U.LeaderboardTitle>
    </U.LeaderboardHeader>
    <U.LeaderboardContent>
      {[
        ["React", 90],
        ["Vue", 65],
        ["Svelte", 35],
      ].map(([name, value]) => (
        <U.LeaderboardItem key={name} value={value}>
          <U.LeaderboardStart>{name}</U.LeaderboardStart>
          <U.LeaderboardEnd>{value}</U.LeaderboardEnd>
        </U.LeaderboardItem>
      ))}
    </U.LeaderboardContent>
  </U.Leaderboard>,
  400,
);
for (const color of ["#155dfc", "#009966", "#e7000b"])
  add("Color Swatch", { Color: color }, <U.ColorSwatch color={color} />);
add(
  "Color Swatch Picker",
  { State: "Selected" },
  <U.ColorSwatchPicker defaultValue="#155dfc">
    {["#155dfc", "#009966", "#e7000b"].map((color) => (
      <U.ColorSwatchPickerItem key={color} color={color}>
        <U.ColorSwatch />
      </U.ColorSwatchPickerItem>
    ))}
  </U.ColorSwatchPicker>,
);
add(
  "Color Area",
  { State: "Default" },
  <U.ColorArea defaultValue="hsl(220, 80%, 55%)" />,
);
add(
  "Color Wheel",
  { State: "Default" },
  <U.ColorWheel defaultValue="hsl(220, 80%, 55%)" />,
);
add(
  "Color Slider",
  { Channel: "Hue" },
  <U.ColorSlider channel="hue" defaultValue="hsl(220, 80%, 55%)">
    <U.Label>Hue</U.Label>
    <U.ColorSliderOutput />
    <U.ColorSliderTrack>
      <U.ColorThumb />
    </U.ColorSliderTrack>
  </U.ColorSlider>,
  320,
);
add(
  "Tree",
  { State: "Expanded" },
  <U.Tree aria-label="Files" defaultExpandedKeys={["src"]}>
    <U.TreeItem id="src" textValue="src">
      <U.TreeContent>src</U.TreeContent>
      <U.TreeItem id="components" textValue="components">
        <U.TreeContent>components</U.TreeContent>
      </U.TreeItem>
      <U.TreeItem id="app" textValue="App.tsx">
        <U.TreeContent>App.tsx</U.TreeContent>
      </U.TreeItem>
    </U.TreeItem>
  </U.Tree>,
  320,
);
add(
  "Table",
  { Variant: "Default" },
  <U.Table aria-label="Team">
    <U.TableHeader>
      <U.TableColumn isRowHeader>Name</U.TableColumn>
      <U.TableColumn>Role</U.TableColumn>
      <U.TableColumn>Status</U.TableColumn>
    </U.TableHeader>
    <U.TableBody>
      <U.TableRow id="chris">
        <U.TableCell>Chris</U.TableCell>
        <U.TableCell>Owner</U.TableCell>
        <U.TableCell>Active</U.TableCell>
      </U.TableRow>
      <U.TableRow id="alex">
        <U.TableCell>Alex</U.TableCell>
        <U.TableCell>Editor</U.TableCell>
        <U.TableCell>Active</U.TableCell>
      </U.TableRow>
    </U.TableBody>
  </U.Table>,
  520,
);

add(
  "Date Picker",
  { State: "Filled" },
  <U.DatePicker defaultValue={parseDate("2026-09-03")}>
    <U.Label>Date</U.Label>
    <U.DatePickerTrigger />
  </U.DatePicker>,
  320,
);
add(
  "Date Range Picker",
  { State: "Filled" },
  <U.DateRangePicker
    defaultValue={{
      start: parseDate("2026-09-03"),
      end: parseDate("2026-09-08"),
    }}
  >
    <U.Label>Date range</U.Label>
    <U.DateRangePickerTrigger />
  </U.DateRangePicker>,
  360,
);
add(
  "Multiple Select",
  { State: "Filled" },
  <U.MultipleSelect defaultValue={["react"]}>
    <U.Label>Frameworks</U.Label>
    <U.MultipleSelectContent
      items={[
        { id: "react", name: "React" },
        { id: "vue", name: "Vue" },
      ]}
    >
      {(item) => (
        <U.MultipleSelectItem id={item.id}>{item.name}</U.MultipleSelectItem>
      )}
    </U.MultipleSelectContent>
  </U.MultipleSelect>,
  320,
);
add(
  "Input OTP",
  { State: "Filled" },
  <U.InputOTP maxLength={6} value="123456" onChange={() => {}}>
    <U.InputOTPLabel>Verification code</U.InputOTPLabel>
    <U.InputOTPControl>
      <U.InputOTPGroup>
        {[0, 1, 2].map((index) => (
          <U.InputOTPSlot key={index} index={index} />
        ))}
      </U.InputOTPGroup>
      <U.InputOTPSeparator />
      <U.InputOTPGroup>
        {[3, 4, 5].map((index) => (
          <U.InputOTPSlot key={index} index={index} />
        ))}
      </U.InputOTPGroup>
    </U.InputOTPControl>
  </U.InputOTP>,
);
add(
  "Tabs",
  { Orientation: "Horizontal" },
  <U.Tabs defaultSelectedKey="overview">
    <U.TabList aria-label="Project">
      <U.Tab id="overview">Overview</U.Tab>
      <U.Tab id="activity">Activity</U.Tab>
      <U.Tab id="settings">Settings</U.Tab>
    </U.TabList>
    <U.TabPanel id="overview">Everything you need to get started.</U.TabPanel>
    <U.TabPanel id="activity">Recent activity</U.TabPanel>
    <U.TabPanel id="settings">Project settings</U.TabPanel>
  </U.Tabs>,
  400,
);
add(
  "Snippet",
  { Variant: "Command" },
  <U.Snippet defaultSelectedKey="npm">
    <U.SnippetTabsList aria-label="Package manager">
      <U.SnippetTab id="npm">npm</U.SnippetTab>
      <U.SnippetTab id="pnpm">pnpm</U.SnippetTab>
    </U.SnippetTabsList>
    <U.SnippetTabPanel id="npm">npm run dev</U.SnippetTabPanel>
    <U.SnippetTabPanel id="pnpm">pnpm dev</U.SnippetTabPanel>
  </U.Snippet>,
  400,
);
add(
  "Toolbar",
  { Orientation: "Horizontal" },
  <U.Toolbar aria-label="Formatting">
    <U.ToolbarGroup>
      <U.ToolbarItem>Bold</U.ToolbarItem>
      <U.ToolbarItem>Italic</U.ToolbarItem>
    </U.ToolbarGroup>
    <U.ToolbarSeparator />
    <U.ToolbarItem>Link</U.ToolbarItem>
  </U.Toolbar>,
);
add(
  "Pagination",
  { Variant: "Numbered" },
  <U.Pagination>
    <U.PaginationList>
      <U.PaginationPrevious href="#">Previous</U.PaginationPrevious>
      <U.PaginationItem isCurrent>1</U.PaginationItem>
      <U.PaginationItem href="#">2</U.PaginationItem>
      <U.PaginationItem href="#">3</U.PaginationItem>
      <U.PaginationNext href="#">Next</U.PaginationNext>
    </U.PaginationList>
  </U.Pagination>,
  480,
);
add(
  "File Trigger",
  { State: "Default" },
  <U.FileTrigger>Choose file</U.FileTrigger>,
);
add(
  "Drop Zone",
  { State: "Default" },
  <U.DropZone>
    <div className="flex flex-col items-center gap-3">
      <U.Text>Drag files here or choose a file.</U.Text>
      <U.FileTrigger>Choose file</U.FileTrigger>
    </div>
  </U.DropZone>,
  400,
);
add(
  "Container",
  { Variant: "Default" },
  <U.Container>
    <U.Text>Content follows the container padding.</U.Text>
  </U.Container>,
  600,
);
add(
  "Scroll Area",
  { Orientation: "Vertical" },
  <U.ScrollArea className="h-32">
    <div className="space-y-4">
      {[
        "Overview",
        "Activity",
        "Members",
        "Settings",
        "Billing",
        "Integrations",
      ].map((t) => (
        <U.Text key={t}>{t}</U.Text>
      ))}
    </div>
  </U.ScrollArea>,
  320,
);
add(
  "Carousel",
  { Orientation: "Horizontal" },
  <U.Carousel>
    <U.CarouselContent>
      {["First slide", "Second slide"].map((t) => (
        <U.CarouselItem key={t}>
          <U.Card>
            <U.CardContent className="flex h-40 items-center justify-center">
              {t}
            </U.CardContent>
          </U.Card>
        </U.CarouselItem>
      ))}
    </U.CarouselContent>
    <U.CarouselHandler>
      <U.CarouselButton segment="previous" />
      <U.CarouselButton segment="next" />
    </U.CarouselHandler>
  </U.Carousel>,
  400,
);
add(
  "Navbar",
  { Variant: "Desktop" },
  <U.NavbarProvider>
    <U.Navbar>
      <U.NavbarStart>
        <U.Strong>Project</U.Strong>
      </U.NavbarStart>
      <U.NavbarSection>
        <U.NavbarItem href="#" isCurrent>
          Overview
        </U.NavbarItem>
        <U.NavbarItem href="#">Activity</U.NavbarItem>
      </U.NavbarSection>
      <U.NavbarSpacer />
      <U.Avatar initials="CH" />
    </U.Navbar>
  </U.NavbarProvider>,
  800,
);
add(
  "Sidebar",
  { Variant: "Expanded" },
  <U.SidebarProvider style={{ minHeight: 400 }}>
    <U.Sidebar collapsible="none" style={{ height: 400 }}>
      <U.SidebarHeader>
        <U.Strong>Workspace</U.Strong>
      </U.SidebarHeader>
      <U.SidebarContent>
        <U.SidebarSection title="Project">
          <U.SidebarItem href="#" isCurrent>
            <HomeIcon />
            <U.SidebarLabel>Overview</U.SidebarLabel>
          </U.SidebarItem>
          <U.SidebarItem href="#">
            <Cog6ToothIcon />
            <U.SidebarLabel>Settings</U.SidebarLabel>
          </U.SidebarItem>
        </U.SidebarSection>
      </U.SidebarContent>
      <U.SidebarFooter>
        <U.Avatar initials="CH" />
        <U.Text>Chris</U.Text>
      </U.SidebarFooter>
    </U.Sidebar>
  </U.SidebarProvider>,
  288,
);
const series = [
  { month: "Apr", Desktop: 80, Mobile: 45 },
  { month: "May", Desktop: 120, Mobile: 75 },
  { month: "Jun", Desktop: 95, Mobile: 65 },
  { month: "Jul", Desktop: 160, Mobile: 100 },
];
const chartConfig = {
  Desktop: { label: "Desktop", color: "chart-1" },
  Mobile: { label: "Mobile", color: "chart-3" },
};
for (const [family, Component] of [
  ["Area Chart", U.AreaChart],
  ["Bar Chart", U.BarChart],
  ["Line Chart", U.LineChart],
])
  add(
    family,
    { Variant: "Default" },
    <Component
      data={series}
      dataKey="month"
      config={chartConfig}
      containerHeight={280}
    />,
    480,
  );
for (const variant of ["pie", "donut"])
  add(
    "Pie Chart",
    { Variant: variant },
    <U.PieChart
      data={[
        { name: "Desktop", value: 65 },
        { name: "Mobile", value: 35 },
      ]}
      dataKey="value"
      nameKey="name"
      config={chartConfig}
      variant={variant}
      containerHeight={240}
      showLabel={variant === "donut"}
    />,
    300,
  );
add(
  "Dialog",
  { Variant: "Default" },
  <U.Dialog aria-label="Edit project">
    <U.DialogHeader
      title="Edit project"
      description="Update your project details."
    />
    <U.DialogBody>
      <U.TextField>
        <U.Label>Name</U.Label>
        <U.Input defaultValue="My project" />
      </U.TextField>
    </U.DialogBody>
    <U.DialogFooter>
      <U.Button intent="plain">Cancel</U.Button>
      <U.Button>Save changes</U.Button>
    </U.DialogFooter>
  </U.Dialog>,
  448,
);
add(
  "Modal",
  { State: "Open" },
  <U.Modal isOpen={selectedFamily === "Modal"}>
    <U.Button>Open modal</U.Button>
    <U.ModalContent>
      <U.ModalHeader
        title="Edit project"
        description="Update your project details."
      />
      <U.ModalBody>
        <U.TextField>
          <U.Label>Name</U.Label>
          <U.Input defaultValue="My project" />
        </U.TextField>
      </U.ModalBody>
      <U.ModalFooter>
        <U.Button intent="plain">Cancel</U.Button>
        <U.Button>Save changes</U.Button>
      </U.ModalFooter>
    </U.ModalContent>
  </U.Modal>,
);
add(
  "Sheet",
  { State: "Open" },
  <U.Sheet isOpen={selectedFamily === "Sheet"}>
    <U.Button>Open sheet</U.Button>
    <U.SheetContent>
      <U.SheetHeader
        title="Project details"
        description="Everything in one place."
      />
      <U.SheetBody>
        <U.Text>Review your project settings.</U.Text>
      </U.SheetBody>
      <U.SheetFooter>
        <U.Button>Done</U.Button>
      </U.SheetFooter>
    </U.SheetContent>
  </U.Sheet>,
);
add(
  "Drawer",
  { State: "Open" },
  <U.Drawer isOpen={selectedFamily === "Drawer"}>
    <U.Button>Open drawer</U.Button>
    <U.DrawerContent>
      <U.DrawerHeader>
        <U.DrawerTitle>Quick actions</U.DrawerTitle>
        <U.DrawerDescription>Choose what to do next.</U.DrawerDescription>
      </U.DrawerHeader>
      <U.DrawerBody>
        <U.Button>Create project</U.Button>
      </U.DrawerBody>
      <U.DrawerFooter>
        <U.Button intent="plain">Cancel</U.Button>
      </U.DrawerFooter>
    </U.DrawerContent>
  </U.Drawer>,
);
add(
  "Popover",
  { State: "Open" },
  <U.Popover isOpen={selectedFamily === "Popover"}>
    <U.Button>Details</U.Button>
    <U.PopoverContent>
      <U.PopoverHeader
        title="Project details"
        description="A short contextual message."
      />
      <U.PopoverBody>
        <U.Text>Keep related information nearby.</U.Text>
      </U.PopoverBody>
      <U.PopoverFooter>
        <U.Button size="sm">Got it</U.Button>
      </U.PopoverFooter>
    </U.PopoverContent>
  </U.Popover>,
);
add(
  "Tooltip",
  { State: "Open" },
  <U.Tooltip isOpen={selectedFamily === "Tooltip"}>
    <U.Button>Hover for help</U.Button>
    <U.TooltipContent>Helpful context</U.TooltipContent>
  </U.Tooltip>,
);
add(
  "Preview",
  { State: "Open" },
  <U.Preview isOpen={selectedFamily === "Preview"}>
    <U.Link href="#">Preview project</U.Link>
    <U.PreviewContent>
      <U.Strong>ConvexHackathon</U.Strong>
      <U.Text>A React and Convex starter.</U.Text>
    </U.PreviewContent>
  </U.Preview>,
);
add(
  "Menu",
  { State: "Open" },
  <U.Menu isOpen={selectedFamily === "Menu"}>
    <U.Button>Actions</U.Button>
    <U.MenuContent>
      <U.MenuItem id="edit">
        <U.MenuLabel>Edit project</U.MenuLabel>
      </U.MenuItem>
      <U.MenuItem id="duplicate">
        <U.MenuLabel>Duplicate</U.MenuLabel>
      </U.MenuItem>
      <U.MenuSeparator />
      <U.MenuItem id="delete" intent="danger">
        <U.MenuLabel>Delete project</U.MenuLabel>
      </U.MenuItem>
    </U.MenuContent>
  </U.Menu>,
);
add(
  "Command Menu",
  { State: "Open" },
  <U.CommandMenu isOpen={selectedFamily === "Command Menu"}>
    <U.CommandMenuSearch placeholder="Search commands..." />
    <U.CommandMenuList>
      <U.CommandMenuSection label="Suggestions">
        <U.CommandMenuItem id="home" textValue="Home">
          <HomeIcon />
          <U.CommandMenuLabel>Go home</U.CommandMenuLabel>
        </U.CommandMenuItem>
        <U.CommandMenuItem id="settings" textValue="Settings">
          <Cog6ToothIcon />
          <U.CommandMenuLabel>Settings</U.CommandMenuLabel>
        </U.CommandMenuItem>
      </U.CommandMenuSection>
    </U.CommandMenuList>
    <U.CommandMenuFooter>Type to search commands</U.CommandMenuFooter>
  </U.CommandMenu>,
);

add(
  "Color Picker",
  { Variant: "Inline" },
  <U.ColorPicker defaultValue="hsl(220, 80%, 55%)">
    <div className="flex w-56 flex-col gap-3">
      <U.ColorArea />
      <U.ColorSlider channel="hue">
        <U.ColorSliderTrack>
          <U.ColorThumb />
        </U.ColorSliderTrack>
      </U.ColorSlider>
      <div className="flex items-end gap-2">
        <U.ColorField className="min-w-0 flex-1">
          <U.Label>Color</U.Label>
          <U.Input />
        </U.ColorField>
        <U.EyeDropper />
      </div>
    </div>
  </U.ColorPicker>,
);
add(
  "Context Menu",
  { State: "Open" },
  <U.ContextMenu isOpen={selectedFamily === "Context Menu"}>
    <U.Button>Right click</U.Button>
    <U.ContextMenuContent>
      <U.ContextMenuItem id="open">
        <U.ContextMenuLabel>Open project</U.ContextMenuLabel>
      </U.ContextMenuItem>
      <U.ContextMenuItem id="rename">
        <U.ContextMenuLabel>Rename</U.ContextMenuLabel>
      </U.ContextMenuItem>
      <U.ContextMenuSeparator />
      <U.ContextMenuItem id="delete" intent="danger">
        <U.ContextMenuLabel>Delete</U.ContextMenuLabel>
      </U.ContextMenuItem>
    </U.ContextMenuContent>
  </U.ContextMenu>,
);
function ToastDemo() {
  const [theme, setTheme] = React.useState("light");
  React.useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      ),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    for (const type of ["normal", "success", "info", "warning", "error"]) {
      const show = type === "normal" ? toast : toast[type];
      show(
        type === "error"
          ? "Could not save changes"
          : type === "warning"
            ? "Review your changes"
            : type === "info"
              ? "An update is available"
              : "Changes saved",
        {
          id: type,
          description: "A short message with more detail.",
          duration: Infinity,
        },
      );
    }
    return () => observer.disconnect();
  }, []);
  return (
    <ThemeProvider storageKey="intent-kit-theme">
      <U.Toast theme={theme} expand visibleToasts={5} duration={Infinity} />
    </ThemeProvider>
  );
}
for (const [i, intent] of [
  "normal",
  "success",
  "info",
  "warning",
  "error",
].entries())
  add("Toast", { Intent: intent }, i === 0 ? <ToastDemo /> : <div />);

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error: String(error) };
  }
  render() {
    return this.state.error ? (
      <pre data-error>{this.state.error}</pre>
    ) : (
      this.props.children
    );
  }
}
const chosen = new URLSearchParams(location.search).get("family");
window.intentFixtures = Object.fromEntries(
  Object.entries(fixtures).map(([key, value]) => [
    key,
    value.map(({ props, width }) => ({ props, width })),
  ]),
);
const families = chosen
  ? [[chosen, fixtures[chosen] ?? []]]
  : Object.entries(fixtures);
createRoot(document.getElementById("root")).render(
  <div style={{ padding: 40 }}>
    {families.map(([family, examples]) => (
      <section key={family} data-family={family} style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>
          {family}
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: 32,
          }}
        >
          {examples.map(({ props, node, width }, i) => (
            <div key={i}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted-fg)",
                  marginBottom: 12,
                }}
              >
                {Object.entries(props)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </div>
              <Boundary>
                <div
                  data-specimen={i}
                  style={{ width: width ?? "max-content" }}
                >
                  {node}
                </div>
              </Boundary>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>,
);

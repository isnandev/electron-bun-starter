import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@electron-bun-starter/ui";
import { AppNavbar } from "./components/AppNavbar";

export { useServerStatus, getApiClient, type ServerStatus, type HealthData } from "./useServerStatus";

type Theme = "light" | "dark";

function readTheme(): Theme {
  const savedTheme = window.localStorage.getItem("theme");
  const isDark = savedTheme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  return isDark ? "dark" : "light";
}

export function App() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const isDark = theme === "dark";

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppNavbar isDark={isDark} onToggleTheme={toggleTheme} />

      <main className="welcome-main mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">A fresh canvas</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Welcome to your new app.</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Your workspace is ready. Start with a clean page and build from here.
        </p>

        <Card className="mt-9 w-full max-w-xl rounded-xl text-left">
          <CardHeader className="items-center pb-4 text-center">
            <h2 className="text-sm font-medium">Component playground</h2>
            <p className="text-sm text-muted-foreground">Try the shadcn dialog and sheet.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 pb-6 sm:grid-cols-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full justify-center">
                  <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Test dialog</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Your dialog is working</DialogTitle>
                  <DialogDescription>
                    This accessible dialog uses the shared shadcn-style UI package and Radix primitives.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Close dialog</Button></DialogClose>
                  <DialogClose asChild><Button><Check className="size-4" aria-hidden="true" />Looks good</Button></DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full justify-center" variant="outline">Test sheet</Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Your sheet is working</SheetTitle>
                  <SheetDescription>A side panel for settings, details, and other focused tasks.</SheetDescription>
                </SheetHeader>
                <Card className="rounded-lg shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">Shared components</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Buttons, cards, dialogs, and sheets live in one package.</p>
                  </CardContent>
                </Card>
                <SheetFooter>
                  <SheetClose asChild><Button>Done</Button></SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

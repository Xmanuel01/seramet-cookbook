import type { CookbookWorkspace } from "../types"
import { supabase } from "./supabase"

const ROOT_TEST_KEY = "seramet-cookbook:root-test-passcode"

export function getRootTestPasscode() {
  if (typeof window === "undefined") return ""
  return window.sessionStorage.getItem(ROOT_TEST_KEY) || ""
}

export function isRootTestSession() {
  return Boolean(getRootTestPasscode())
}

export function clearRootTestSession() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(ROOT_TEST_KEY)
}

export async function activateRootTestSession(passcode: string): Promise<CookbookWorkspace> {
  const code = passcode.trim()
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit temporary root passcode.")

  const { data, error } = await supabase.functions.invoke("cookbook-api-test", {
    headers: { "x-cookbook-test-passcode": code },
    body: { action: "profile" },
  })

  if (error) throw new Error(error.message || "Temporary root access is unavailable.")
  const response = data as { ok?: boolean; data?: CookbookWorkspace; error?: string }
  if (!response?.ok || !response.data) {
    throw new Error(response?.error || "Temporary root passcode is invalid or expired.")
  }

  window.sessionStorage.setItem(ROOT_TEST_KEY, code)
  return response.data
}

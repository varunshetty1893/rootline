import emailjs from "@emailjs/browser";

const STORAGE_KEY = "rootline_emailjs_config";

/**
 * Retrieves the active EmailJS credentials from environment variables or localStorage.
 */
export function getEmailJsConfig() {
  let stored = {};
  if (typeof window !== "undefined") {
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      if (item) stored = JSON.parse(item);
    } catch {
      // ignore parse errors
    }
  }

  const serviceId =
    stored.serviceId ||
    import.meta.env.VITE_EMAILJS_SERVICE_ID ||
    "";

  const templateId =
    stored.templateId ||
    import.meta.env.VITE_EMAILJS_TEMPLATE_ID ||
    "";

  const publicKey =
    stored.publicKey ||
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY ||
    "";

  return {
    serviceId: serviceId.trim(),
    templateId: templateId.trim(),
    publicKey: publicKey.trim(),
    isConfigured: Boolean(serviceId.trim() && templateId.trim() && publicKey.trim()),
    isCustom: Boolean(stored.serviceId && stored.templateId && stored.publicKey),
  };
}

/**
 * Persists user-entered EmailJS credentials to browser storage.
 */
export function saveEmailJsConfig({ serviceId, templateId, publicKey }) {
  if (typeof window === "undefined") return;
  const config = {
    serviceId: (serviceId || "").trim(),
    templateId: (templateId || "").trim(),
    publicKey: (publicKey || "").trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  return getEmailJsConfig();
}

/**
 * Clears custom credentials from localStorage.
 */
export function clearEmailJsConfig() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Sends a 6-digit OTP code directly from the user's browser using EmailJS.
 * This bypasses hosting provider outbound port firewalls (such as Render's blocked SMTP).
 */
export async function sendBrowserDirectOtp({
  toEmail,
  toName = "Rootline User",
  otpCode,
  resetUrl,
}) {
  const config = getEmailJsConfig();

  if (!config.isConfigured) {
    return {
      success: false,
      skipped: true,
      error: "EmailJS is not configured. Using in-app delivery mode.",
    };
  }

  const templateParams = {
    to_email: toEmail,
    email: toEmail,
    recipient: toEmail,
    user_name: toName,
    to_name: toName,
    otp_code: otpCode,
    otp: otpCode,
    passcode: otpCode,
    reset_link: resetUrl || `${window.location.origin}/forgot-password`,
    app_name: "Rootline",
  };

  try {
    const response = await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      config.publicKey
    );

    return {
      success: true,
      status: response.status,
      text: response.text,
    };
  } catch (err) {
    console.error("[EmailJS] Direct browser delivery failed:", err);
    return {
      success: false,
      error: err?.text || err?.message || "Failed to dispatch email via EmailJS.",
    };
  }
}

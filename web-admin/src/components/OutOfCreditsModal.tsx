/**
 * Shown when an un-crop is blocked server-side (HttpsError resource-exhausted):
 * either the free daily quota is spent, or a subscriber is out of monthly credits.
 * Copy adapts to which one it is.
 */
type Reason = "OUT_OF_FREE_DAILY" | "OUT_OF_CREDITS" | "GENERIC";

export default function OutOfCreditsModal({
  open,
  reason,
  message,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  reason: Reason;
  message?: string;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  if (!open) return null;

  const isCredits = reason === "OUT_OF_CREDITS";
  const title = isCredits ? "You're out of credits" : "You've hit today's limit";
  const body =
    message ||
    (isCredits
      ? "You've used all your monthly credits. Upgrade to Studio for 300 credits a month, or wait for your next cycle."
      : "You've used your 3 free un-crops for today. Upgrade for 100+ high-speed monthly exports, batch workflows, and no daily limit.");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">✦</div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button className="app-cta" onClick={onUpgrade}>
            {isCredits ? "Upgrade to Studio" : "View plans"}
          </button>
          <button className="ghost" onClick={onClose}>
            Maybe later
          </button>
        </div>
        <p className="modal-fine">Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
}

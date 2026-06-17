import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { changePassword, updateProfile, uploadAvatar } from "../api/users";
import Avatar from "../components/common/Avatar";
import { CameraIcon } from "../components/icons";
import useAuthStore from "../store/authStore";
import { getErrorMessage } from "../utils/apiError";
import { formatDate } from "../utils/format";
import "./pages.css";

const MAX_AVATAR_BYTES = 2_000_000; // 2 MB

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
  });
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t("profile.avatarTooLarge"));
      return;
    }

    setAvatarError("");
    setAvatarUploading(true);
    try {
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const { user: updated } = await uploadAvatar(dataUri);
      setUser(updated);
    } catch (err) {
      setAvatarError(getErrorMessage(err, t));
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setProfileSubmitting(true);
    try {
      const { user: updated } = await updateProfile(profileForm);
      setUser(updated);
      setProfileMessage(t("profile.updateSuccess"));
    } catch (err) {
      setProfileError(getErrorMessage(err, t));
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError(t("validation.passwordMismatch"));
      return;
    }

    setPasswordSubmitting(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage(t("profile.passwordUpdateSuccess"));
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setPasswordError(getErrorMessage(err, t));
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>{t("profile.title")}</h1>
        {user && <p className="text-muted">{t("profile.memberSince", { date: formatDate(user.createdAt, i18n.language) })}</p>}
      </div>

      <div className="profile-grid">
        <div className="card stack">
          <h2>{t("profile.personalInfo")}</h2>

          <div className="avatar-upload">
            <button
              type="button"
              className="avatar-upload__btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label={t("profile.changeAvatar")}
            >
              <Avatar user={user} size={72} />
              <span className="avatar-upload__overlay">
                {avatarUploading ? <span className="spinner" /> : <CameraIcon />}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleAvatarChange}
            />
            {avatarError && <p className="text-sm text-danger">{avatarError}</p>}
          </div>

          {profileMessage && (
            <output className="alert alert-success">
              {profileMessage}
            </output>
          )}
          {profileError && (
            <div className="alert alert-danger" role="alert">
              {profileError}
            </div>
          )}

          <form className="stack" onSubmit={handleProfileSubmit}>
            <div className="field">
              <label htmlFor="profile-email">{t("auth.email")}</label>
              <input id="profile-email" type="email" value={user?.email || ""} disabled />
              <span className="text-sm text-muted">{t("profile.emailHint")}</span>
            </div>

            <div className="field-grid field-grid-2">
              <div className="field">
                <label htmlFor="profile-firstName">{t("auth.firstName")}</label>
                <input
                  id="profile-firstName"
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={profileForm.firstName}
                  onChange={(event) => setProfileForm((form) => ({ ...form, firstName: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="profile-lastName">{t("auth.lastName")}</label>
                <input
                  id="profile-lastName"
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={profileForm.lastName}
                  onChange={(event) => setProfileForm((form) => ({ ...form, lastName: event.target.value }))}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="profile-phone">{t("auth.phone")}</label>
              <input
                id="profile-phone"
                type="tel"
                required
                value={profileForm.phone}
                onChange={(event) => setProfileForm((form) => ({ ...form, phone: event.target.value }))}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={profileSubmitting}>
              {profileSubmitting ? <span className="spinner" /> : t("common.save")}
            </button>
          </form>
        </div>

        <div className="card stack">
          <h2>{t("profile.changePasswordTitle")}</h2>

          {passwordMessage && (
            <output className="alert alert-success">
              {passwordMessage}
            </output>
          )}
          {passwordError && (
            <div className="alert alert-danger" role="alert">
              {passwordError}
            </div>
          )}

          <form className="stack" onSubmit={handlePasswordSubmit}>
            <div className="field">
              <label htmlFor="profile-currentPassword">{t("auth.currentPassword")}</label>
              <input
                id="profile-currentPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={72}
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((form) => ({ ...form, currentPassword: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-newPassword">{t("auth.newPassword")}</label>
              <input
                id="profile-newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((form) => ({ ...form, newPassword: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-confirmNewPassword">{t("auth.confirmPassword")}</label>
              <input
                id="profile-confirmNewPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={passwordForm.confirmNewPassword}
                onChange={(event) => setPasswordForm((form) => ({ ...form, confirmNewPassword: event.target.value }))}
              />
            </div>
            <span className="text-sm text-muted">{t("validation.passwordRules")}</span>

            <button type="submit" className="btn btn-primary" disabled={passwordSubmitting}>
              {passwordSubmitting ? <span className="spinner" /> : t("common.save")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

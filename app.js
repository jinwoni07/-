// ============================================================
// Constants
// ============================================================

const TIME_SLOTS = [
  { text: "09:00 ~ 11:00", icon: "sun" },
  { text: "11:00 ~ 13:00", icon: "sun" },
  { text: "13:00 ~ 15:00", icon: "sun" },
  { text: "15:00 ~ 17:00", icon: "cloud-sun" },
  { text: "17:00 ~ 19:00", icon: "sunset" },
  { text: "19:00 ~ 21:00", icon: "moon" }
];

const ROOM_NAMES = {
  1: "제 1 연습실",
  2: "제 2 연습실",
  3: "제 3 연습실"
};

// Operating dates: June 7 ~ June 15, 2026
const OPERATING_DATES = [
  { date: "2026-06-07", label: "6/7", day: "토" },
  { date: "2026-06-08", label: "6/8", day: "일" },
  { date: "2026-06-09", label: "6/9", day: "월" },
  { date: "2026-06-10", label: "6/10", day: "화" },
  { date: "2026-06-11", label: "6/11", day: "수" },
  { date: "2026-06-12", label: "6/12", day: "목" },
  { date: "2026-06-13", label: "6/13", day: "금" },
  { date: "2026-06-14", label: "6/14", day: "토" },
  { date: "2026-06-15", label: "6/15", day: "일" }
];

// localStorage key for v4 (date-aware, fresh start)
const STORAGE_KEY = "vocal_v4_reservations";

// ============================================================
// Application State
// ============================================================

const state = {
  currentUser: sessionStorage.getItem("vocal_user") || null,
  selectedDate: OPERATING_DATES[0].date, // default to June 7
  selectedRoomId: null,
  reservations: {},     // keyed by `${date}_room_${roomId}_${slotIndex}`
  pendingBooking: null  // { roomId, slotIndex }
};

// ============================================================
// Reservations: Load / Save
// ============================================================

const initReservations = () => {
  // Wipe all old legacy keys
  ["vocal_practice_reservations", "vocal_reservations_clean", "vocal_reservations_fresh"].forEach(k => {
    localStorage.removeItem(k);
  });

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      state.reservations = JSON.parse(stored);
    } catch (e) {
      state.reservations = {};
    }
  } else {
    state.reservations = {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reservations));
  }
};

const saveReservations = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reservations));
};

const getReservationKey = (date, roomId, slotIndex) =>
  `${date}_room_${roomId}_${slotIndex}`;

// ============================================================
// DOM References
// ============================================================

const elements = {
  header: document.getElementById("app-header"),
  sectionLogin: document.getElementById("section-login"),
  sectionDashboard: document.getElementById("section-dashboard"),

  loginForm: document.getElementById("login-form"),
  studentIdInput: document.getElementById("student-id"),
  studentPwdInput: document.getElementById("student-pwd"),
  errorStudentId: document.getElementById("error-student-id"),
  errorPassword: document.getElementById("error-password"),

  userDisplayId: document.getElementById("user-display-id"),
  btnLogout: document.getElementById("btn-logout"),

  dateSelectorContainer: document.getElementById("date-selector-container"),

  roomsListContainer: document.getElementById("rooms-list-container"),
  schedulerPlaceholder: document.getElementById("scheduler-placeholder"),
  schedulerContent: document.getElementById("scheduler-content"),
  currentRoomName: document.getElementById("current-room-name"),
  currentDateBadge: document.getElementById("current-date-badge"),
  timeSlotsContainer: document.getElementById("time-slots-container"),

  bookingModal: document.getElementById("booking-modal-overlay"),
  modalRoomText: document.getElementById("modal-room-text"),
  modalTimeText: document.getElementById("modal-time-text"),
  modalDateText: document.getElementById("modal-date-text"),
  btnModalCancel: document.getElementById("btn-modal-cancel"),
  btnModalConfirm: document.getElementById("btn-modal-confirm"),

  toastContainer: document.getElementById("toast-container")
};

// ============================================================
// Screen: Login
// ============================================================

const showLogin = () => {
  elements.header.style.display = "none";
  elements.sectionDashboard.style.display = "none";
  elements.sectionDashboard.classList.remove("active");
  elements.sectionLogin.style.display = "flex";

  elements.studentIdInput.value = "";
  elements.studentPwdInput.value = "";
  elements.errorStudentId.style.display = "none";
  elements.errorPassword.style.display = "none";
};

// ============================================================
// Screen: Dashboard
// ============================================================

const showDashboard = () => {
  initReservations();

  elements.sectionLogin.style.display = "none";
  elements.header.style.display = "flex";
  elements.sectionDashboard.style.display = "grid";

  setTimeout(() => {
    elements.sectionDashboard.classList.add("active");
  }, 50);

  elements.userDisplayId.textContent = `${state.currentUser} (학번)`;

  // Reset room + scheduler
  state.selectedRoomId = null;
  document.querySelectorAll(".room-card").forEach(c => c.classList.remove("selected"));
  elements.schedulerPlaceholder.style.display = "flex";
  elements.schedulerContent.style.display = "none";

  // Render date pills
  renderDatePills();
  updateDateBadge();
};

// ============================================================
// Date Pills
// ============================================================

const renderDatePills = () => {
  elements.dateSelectorContainer.innerHTML = "";

  OPERATING_DATES.forEach(({ date, label, day }) => {
    const pill = document.createElement("button");
    pill.className = "date-pill" + (date === state.selectedDate ? " active" : "");
    pill.setAttribute("data-date", date);
    pill.innerHTML = `<span class="date-pill-label">${label}</span><span class="date-pill-day">${day}</span>`;

    pill.addEventListener("click", () => {
      state.selectedDate = date;

      // Update pill active states
      document.querySelectorAll(".date-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");

      updateDateBadge();

      // Re-render slots if a room is already selected
      if (state.selectedRoomId) {
        renderTimeSlots();
      }
    });

    elements.dateSelectorContainer.appendChild(pill);
  });
};

const updateDateBadge = () => {
  const found = OPERATING_DATES.find(d => d.date === state.selectedDate);
  if (found) {
    elements.currentDateBadge.textContent = `2026년 ${found.label} (${found.day})`;
  }
};

// ============================================================
// Room Selection
// ============================================================

elements.roomsListContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".room-card");
  if (!card) return;

  const roomId = parseInt(card.getAttribute("data-room-id"));

  document.querySelectorAll(".room-card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");

  state.selectedRoomId = roomId;

  elements.schedulerPlaceholder.style.display = "none";
  elements.schedulerContent.style.display = "block";
  elements.currentRoomName.querySelector("span").textContent = ROOM_NAMES[roomId];

  renderTimeSlots();
});

// ============================================================
// Time Slots Grid
// ============================================================

const renderTimeSlots = () => {
  const { selectedRoomId: roomId, selectedDate: date } = state;
  if (!roomId || !date) return;

  elements.timeSlotsContainer.innerHTML = "";

  TIME_SLOTS.forEach((slot, index) => {
    const key = getReservationKey(date, roomId, index);
    const reservedBy = state.reservations[key];
    const isOccupied = !!reservedBy;

    const slotCard = document.createElement("div");
    slotCard.className = `time-slot ${isOccupied ? "occupied" : "available"}`;
    slotCard.setAttribute("data-slot-index", index);

    slotCard.innerHTML = `
      <div class="slot-time-info">
        <i data-lucide="${slot.icon}"></i>
        <span class="slot-time-text">${slot.text}</span>
      </div>
      <div class="slot-status">
        ${isOccupied
          ? `<span>예약 완료</span> <span class="student-id-display">${reservedBy}</span>`
          : `<span>예약 가능</span> <i data-lucide="check" style="width: 14px; height: 14px;"></i>`
        }
      </div>
    `;

    if (!isOccupied) {
      slotCard.addEventListener("click", () => {
        openBookingModal(roomId, index);
      });
    }

    elements.timeSlotsContainer.appendChild(slotCard);
  });

  lucide.createIcons();
};

// ============================================================
// Booking Modal
// ============================================================

const openBookingModal = (roomId, slotIndex) => {
  state.pendingBooking = { roomId, slotIndex };

  const found = OPERATING_DATES.find(d => d.date === state.selectedDate);
  const dateLabel = found ? `2026년 ${found.label} (${found.day})` : state.selectedDate;

  elements.modalRoomText.innerHTML = `연습실: <span class="highlight">${ROOM_NAMES[roomId]}</span>`;
  elements.modalDateText.innerHTML = `날짜: <span class="highlight">${dateLabel}</span>`;
  elements.modalTimeText.innerHTML = `시간대: <span class="highlight">${TIME_SLOTS[slotIndex].text}</span>`;

  elements.bookingModal.classList.add("active");
};

const closeBookingModal = () => {
  elements.bookingModal.classList.remove("active");
  state.pendingBooking = null;
};

elements.btnModalCancel.addEventListener("click", closeBookingModal);

elements.bookingModal.addEventListener("click", (e) => {
  if (e.target === elements.bookingModal) closeBookingModal();
});

elements.btnModalConfirm.addEventListener("click", () => {
  if (!state.pendingBooking || !state.currentUser) return;

  const { roomId, slotIndex } = state.pendingBooking;
  const key = getReservationKey(state.selectedDate, roomId, slotIndex);

  state.reservations[key] = state.currentUser;
  saveReservations();

  closeBookingModal();
  renderTimeSlots();

  const found = OPERATING_DATES.find(d => d.date === state.selectedDate);
  const dateLabel = found ? `${found.label} (${found.day})` : state.selectedDate;
  const timeText = TIME_SLOTS[slotIndex].text;
  const roomName = ROOM_NAMES[roomId];

  showToast(
    "예약 완료",
    `${dateLabel} ${roomName}<br><strong>${timeText}</strong> 예약이 완료되었습니다.`,
    "success",
    5000
  );

  // Auto logout and return to login after 5 seconds
  setTimeout(() => {
    state.currentUser = null;
    sessionStorage.removeItem("vocal_user");
    showLogin();
    showToast("로그아웃 안내", "안전을 위해 자동으로 로그아웃되었습니다.", "info", 3000);
  }, 5000);
});

// ============================================================
// Logout
// ============================================================

elements.btnLogout.addEventListener("click", () => {
  state.currentUser = null;
  sessionStorage.removeItem("vocal_user");
  showLogin();
  showToast("로그아웃 완료", "로그아웃되었습니다.", "info");
});

// ============================================================
// Auth
// ============================================================

elements.loginForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const studentId = elements.studentIdInput.value.trim();
  const password = elements.studentPwdInput.value;

  let hasError = false;

  const idPattern = /^[0-9]{5,10}$/;
  if (!idPattern.test(studentId)) {
    elements.errorStudentId.style.display = "block";
    hasError = true;
  } else {
    elements.errorStudentId.style.display = "none";
  }

  if (password.length < 4) {
    elements.errorPassword.textContent = "비밀번호는 최소 4자리 이상 입력해 주세요.";
    elements.errorPassword.style.display = "block";
    hasError = true;
  } else {
    elements.errorPassword.style.display = "none";
  }

  if (hasError) return;

  state.currentUser = studentId;
  sessionStorage.setItem("vocal_user", studentId);
  showDashboard();
});

// ============================================================
// Toast Notifications
// ============================================================

const showToast = (title, message, type = "success", duration = 5000) => {
  const toast = document.createElement("div");
  toast.className = "toast";

  let iconHtml = '<i data-lucide="check-circle-2"></i>';
  if (type === "info") {
    iconHtml = '<i data-lucide="info"></i>';
  } else if (type === "error") {
    iconHtml = '<i data-lucide="alert-triangle" style="color: var(--color-accent-red);"></i>';
    toast.style.borderColor = "var(--color-accent-red)";
    toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.4), 0 0 15px rgba(244,63,94,0.2)";
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconHtml}</div>
    <div class="toast-content">
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
    <div class="toast-progress"></div>
  `;

  const progressBar = toast.querySelector(".toast-progress");
  if (progressBar) {
    progressBar.style.animationDuration = `${duration}ms`;
    if (type === "error") progressBar.style.backgroundColor = "var(--color-accent-red)";
    if (type === "info") progressBar.style.backgroundColor = "var(--color-primary)";
  }

  elements.toastContainer.appendChild(toast);
  lucide.createIcons();

  const removeToast = () => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", (ev) => {
      if (ev.animationName === "slide-out-toast") toast.remove();
    });
  };

  const timer = setTimeout(removeToast, duration);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    removeToast();
  });
};

// ============================================================
// Init
// ============================================================

const initApp = () => {
  initReservations();
  if (state.currentUser) {
    showDashboard();
  } else {
    showLogin();
  }
  lucide.createIcons();
};

window.addEventListener("DOMContentLoaded", initApp);

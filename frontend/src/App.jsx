import React, { useEffect, useState } from "react";
import { apiRequest, getList } from "./services/apiClient.js";

const menu = [
  { id: "overview", icon: "▦", label: "Dashboard" },
  { id: "books", icon: "▤", label: "Books" },
  { id: "copies", icon: "▣", label: "Book Copies" },
  { id: "institutions", icon: "⌂", label: "Institutions" },
  { id: "members", icon: "♙", label: "Members" },
  { id: "loans", icon: "⇄", label: "Loans" },
  { id: "settings", icon: "⚙", label: "Settings" },
  { id: "users", icon: "♙", label: "Users" },
];

const titles = {
  overview: "Dashboard Overview",
  books: "Book Catalog",
  copies: "Book Copies",
  institutions: "Institutions",
  members: "Library Members",
  loans: "Book Loans",
  settings: "Institution Settings",
  users: "Institution Users",
};

const columns = {
  copies: [
    ["bookTitle", "Book Title"],
    ["bookAuthor", "Author"],
    ["barcode", "Barcode"],
    ["shelfLocation", "Shelf Location"],
    ["status", "Status"],
  ],
  books: [
    ["title", "Book Title"],
    ["author", "Author"],
    ["isbn", "ISBN"],
    ["publisher", "Publisher"],
  ],
  institutions: [
    ["name", "Institution"],
    ["slug", "Code"],
    ["email", "Email"],
    ["status", "Status"],
  ],
  members: [
    ["membershipNumber", "Member Number"],
    ["fullName", "Full Name"],
    ["email", "Email"],
    ["status", "Status"],
  ],
  loans: [
    ["id", "Loan ID"],
    ["member", "Member"],
    ["bookCopy", "Book Title / Author"],
    ["dueAt", "Due Date"],
    ["status", "Status"],
    ["fineAmount", "Fine Amount"],
  ],
  users: [
    ["fullName", "Full Name"],
    ["email", "Email"],
    ["role", "Role"],
    ["status", "Account Status"],
  ],
};

export default function App({ user }) {
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const roleMemberships = (user?.memberships || []).filter(
    (membership) => membership.institution?.status === "APPROVED"
  );
  const hasRole = (...roles) =>
    roleMemberships.some((membership) => roles.includes(membership.role));
  const canManageUsers =
    isSuperAdmin || hasRole("INSTITUTION_ADMIN");
  const canManageSettings =
    isSuperAdmin || hasRole("INSTITUTION_ADMIN");

  const visibleMenu = menu.filter((item) => {
    if (isSuperAdmin) return true;
    if (item.id === "users") return canManageUsers;
    if (item.id === "settings") return canManageSettings;
    if (item.id === "copies") return hasRole("INSTITUTION_ADMIN", "LIBRARIAN");
    if (item.id === "institutions") return hasRole("INSTITUTION_ADMIN");
    if (item.id === "members" || item.id === "loans") {
      return hasRole("INSTITUTION_ADMIN", "LIBRARIAN");
    }
    if (item.id === "overview" || item.id === "books") return true;
    return false;
  });

  const [activeView, setActiveView] = useState("overview");
  const [apiStatus, setApiStatus] = useState("Checking");
  const [books, setBooks] = useState([]);
  const [copyForm, setCopyForm] = useState({
    bookId: "",
    barcode: "",
    shelfLocation: ""
  });
  const [institutions, setInstitutions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ fullName: "", email: "", password: "", role: "LIBRARIAN" });
  const [loanForm, setLoanForm] = useState({ memberId: "", bookCopyId: "" });
  const [settingsForm, setSettingsForm] = useState({ loanDays: 14, maxLoans: 5, finePerDay: "0" });
  const [memberForm, setMemberForm] = useState({ membershipNumber: "", fullName: "", email: "", phone: "" });
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    publisher: "",
    edition: "",
  });
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [institutionForm, setInstitutionForm] = useState({
    name: "",
    email: "",
    slug: "",
  });

  async function refreshBooks() {
    const result = await apiRequest("/books");
    setBooks(getList(result, "books"));
  }

  async function refreshInstitutions() {
    const result = await apiRequest("/institutions");
    setInstitutions(getList(result, "institutions"));
  }

  useEffect(() => {
    apiRequest("/health")
      .then(() => setApiStatus("Connected"))
      .catch(() => setApiStatus("Offline"));

    refreshBooks().catch(() => setBooks([]));
    refreshInstitutions().catch(() => setInstitutions([]));
  }, []);

  useEffect(() => {
    if (!selectedInstitution) {
      setMembers([]);
      setLoans([]);
      setUsers([]);
      return;
    }

    if (activeView === "members" || activeView === "loans") {
      apiRequest(`/members?institutionId=${encodeURIComponent(selectedInstitution)}`)
        .then((result) => setMembers(getList(result, "members")))
        .catch((err) => setError(err.message));
    }

    if (activeView === "loans") {
      apiRequest(`/loans?institutionId=${encodeURIComponent(selectedInstitution)}`)
        .then((result) => setLoans(getList(result, "loans")))
        .catch((err) => setError(err.message));
    }

    if (activeView === "users") {
      apiRequest(`/institutions/${encodeURIComponent(selectedInstitution)}/users`)
        .then((result) => setUsers(getList(result, "users").map((item) => ({
          ...item,
          fullName: item.user?.fullName || "",
          email: item.user?.email || "",
          status: item.user?.status || ""
        }))))
        .catch((err) => setError(err.message));
    }
  }, [activeView, selectedInstitution]);


  useEffect(() => {
    if (activeView !== "settings" || !selectedInstitution) return;

    apiRequest(`/institutions/${encodeURIComponent(selectedInstitution)}/settings`)
      .then((result) => {
        const data = result.data || {};
        setSettingsForm({
          loanDays: Number(data.loanDays ?? 14),
          maxLoans: Number(data.maxLoans ?? 5),
          finePerDay: String(data.finePerDay ?? "0")
        });
      })
      .catch((err) => setError(err.message || "Could not load institution settings."));
  }, [activeView, selectedInstitution]);

  function chooseView(id) {
    setActiveView(id);
    setShowForm(false);
    setError("");
    setNotice("");
  }

  async function submitBook(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setDuplicateCandidates([]);

    const payload = {
      ...bookForm,
      isbn: bookForm.isbn || undefined,
      publisher: bookForm.publisher || undefined,
      edition: bookForm.edition || undefined,
    };

    try {
      await apiRequest("/books", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await refreshBooks();
      setBookForm({
        title: "",
        author: "",
        isbn: "",
        publisher: "",
        edition: "",
      });
      setShowForm(false);
      setDuplicateCandidates([]);
      setNotice("Book added successfully.");
    } catch (err) {
      if (err.data?.code === "DUPLICATE_CANDIDATES") {
        setDuplicateCandidates(err.data.candidates || []);
        setNotice("Possible duplicate books found. Review the existing records below.");
        return;
      }
      setError(err.message || "Could not save the book.");
    }
  }

  async function createSeparateBookAnyway() {
    setError("");
    setNotice("");

    try {
      await apiRequest("/books", {
        method: "POST",
        body: JSON.stringify({
          ...bookForm,
          isbn: bookForm.isbn || undefined,
          publisher: bookForm.publisher || undefined,
          edition: bookForm.edition || undefined,
          confirmDuplicate: true,
        }),
      });

      await refreshBooks();
      setBookForm({
        title: "",
        author: "",
        isbn: "",
        publisher: "",
        edition: "",
      });
      setShowForm(false);
      setDuplicateCandidates([]);
      setNotice("A separate book record was created after your confirmation.");
    } catch (err) {
      setError(err.message || "Could not create the separate book record.");
    }
  }


  async function submitInstitution(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const slug =
      institutionForm.slug.trim() ||
      institutionForm.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    try {
      await apiRequest("/institutions", {
        method: "POST",
        body: JSON.stringify({
          name: institutionForm.name,
          slug,
          email: institutionForm.email || undefined,
        }),
      });

      await refreshInstitutions();
      setInstitutionForm({ name: "", email: "", slug: "" });
      setShowForm(false);
      setNotice("Institution registered. It may need Super Admin approval before use.");
    } catch (err) {
      setError(err.message || "Could not register the institution.");
    }
  }

  async function updateInstitutionStatus(institutionId, action) {
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        `/institutions/${encodeURIComponent(institutionId)}/${action}`,
        { method: "PATCH" }
      );
      await refreshInstitutions();
      setNotice(result.message || `Institution ${action} successful.`);
    } catch (err) {
      setError(err.message || "Could not update institution status.");
    }
  }


  async function submitLoan(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedInstitution) {
      setError("Please select an institution first.");
      return;
    }

    try {
      const result = await apiRequest("/loans", {
        method: "POST",
        body: JSON.stringify({
          institutionId: selectedInstitution,
          memberId: loanForm.memberId,
          bookCopyId: loanForm.bookCopyId
        })
      });

      const refreshedLoans = await apiRequest(
        `/loans?institutionId=${encodeURIComponent(selectedInstitution)}`
      );
      setLoans(getList(refreshedLoans, "loans"));
      await refreshBooks();
      setLoanForm({ memberId: "", bookCopyId: "" });
      setNotice(
        `Book loan recorded successfully. Due: ${
          result.data?.dueAt
            ? new Date(result.data.dueAt).toLocaleDateString()
            : "saved"
        }`
      );
    } catch (err) {
      setError(err.message || "Could not record the loan.");
    }
  }

  async function returnLoan(loanId) {
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        `/loans/${encodeURIComponent(loanId)}/return`,
        { method: "PATCH" }
      );
      const refreshedLoans = await apiRequest(
        `/loans?institutionId=${encodeURIComponent(selectedInstitution)}`
      );
      setLoans(getList(refreshedLoans, "loans"));
      await refreshBooks();
      setNotice(result.message || "Book returned successfully.");
    } catch (err) {
      setError(err.message || "Could not return the book.");
    }
  }


  async function submitCopy(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedInstitution) {
      setError("Select an institution first.");
      return;
    }

    if (!copyForm.bookId || !copyForm.barcode.trim()) {
      setError("Select a book and enter a barcode.");
      return;
    }

    try {
      await apiRequest("/copies", {
        method: "POST",
        body: JSON.stringify({
          institutionId: selectedInstitution,
          bookId: copyForm.bookId,
          barcode: copyForm.barcode.trim(),
          shelfLocation: copyForm.shelfLocation.trim() || undefined
        })
      });

      await refreshBooks();
      setCopyForm({ bookId: "", barcode: "", shelfLocation: "" });
      setShowForm(false);
      setNotice("Book copy registered successfully.");
    } catch (err) {
      setError(err.message || "Could not register the book copy.");
    }
  }

  async function submitMember(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedInstitution) {
      setError("Please select an institution first.");
      return;
    }

    try {
      await apiRequest("/members", {
        method: "POST",
        body: JSON.stringify({
          institutionId: selectedInstitution,
          membershipNumber: memberForm.membershipNumber.trim(),
          fullName: memberForm.fullName.trim(),
          email: memberForm.email.trim() || undefined,
          phone: memberForm.phone.trim() || undefined
        })
      });

      const result = await apiRequest(
        `/members?institutionId=${encodeURIComponent(selectedInstitution)}`
      );
      setMembers(getList(result, "members"));
      setMemberForm({ membershipNumber: "", fullName: "", email: "", phone: "" });
      setShowForm(false);
      setNotice("Member registered successfully.");
    } catch (err) {
      setError(err.message || "Could not register the member.");
    }
  }


  async function submitSettings(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedInstitution) {
      setError("Please select an institution first.");
      return;
    }

    try {
      const result = await apiRequest(
        `/institutions/${encodeURIComponent(selectedInstitution)}/settings`,
        {
          method: "PATCH",
          body: JSON.stringify({
            loanDays: Number(settingsForm.loanDays),
            maxLoans: Number(settingsForm.maxLoans),
            finePerDay: Number(settingsForm.finePerDay)
          })
        }
      );

      const data = result.data || {};
      setSettingsForm({
        loanDays: Number(data.loanDays ?? settingsForm.loanDays),
        maxLoans: Number(data.maxLoans ?? settingsForm.maxLoans),
        finePerDay: String(data.finePerDay ?? settingsForm.finePerDay)
      });
      setNotice(result.message || "Institution settings saved.");
    } catch (err) {
      setError(err.message || "Could not save institution settings.");
    }
  }

  async function submitUser(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedInstitution) {
      setError("Please select an institution first.");
      return;
    }

    try {
      const result = await apiRequest(
        `/institutions/${encodeURIComponent(selectedInstitution)}/users`,
        {
          method: "POST",
          body: JSON.stringify({
            fullName: userForm.fullName.trim(),
            email: userForm.email.trim(),
            password: userForm.password,
            role: userForm.role
          })
        }
      );

      const refreshed = await apiRequest(
        `/institutions/${encodeURIComponent(selectedInstitution)}/users`
      );

      setUsers(getList(refreshed, "users").map((item) => ({
        ...item,
        fullName: item.user?.fullName || "",
        email: item.user?.email || "",
        status: item.user?.status || ""
      })));

      setUserForm({
        fullName: "",
        email: "",
        password: "",
        role: "LIBRARIAN"
      });
      setShowForm(false);
      setNotice(result.message || "User created successfully.");
    } catch (err) {
      setError(err.message || "Could not create user.");
    }
  }

  const currentList =
    activeView === "books" ? books :
    activeView === "copies" ? (selectedInstitution
      ? books.flatMap((book) =>
          (book.copiesAsBook || [])
            .filter((copy) => copy.institutionId === selectedInstitution)
            .map((copy) => ({
              ...copy,
              bookTitle: book.title,
              bookAuthor: book.author
            }))
        )
      : []) :
    activeView === "institutions" ? institutions :
    activeView === "members" ? members :
    activeView === "loans" ? loans :
    activeView === "users" ? users : [];

  function displayValue(value) {
    if (value === null || value === undefined || value === "") return "—";

    if (typeof value === "object") {
      if (value.book) {
        const title = value.book.title || "";
        const author = value.book.author || "";
        return [title, author].filter(Boolean).join(" — ") || "—";
      }

      return value.fullName || value.title || value.name || "—";
    }

    return String(value);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <strong>Libra</strong>
            <span>Library System</span>
          </div>
        </div>

        <div className="nav-heading">WORKSPACE</div>
        <nav className="navigation">
          {visibleMenu.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
              onClick={() => chooseView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {activeView === item.id && <span className="active-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="small-book">▤</div>
          <strong>One library platform</strong>
          <p>Manage books, institutions and circulation in one place.</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">Library Management / <span>{titles[activeView]}</span></div>
            <h1>{titles[activeView]}</h1>
          </div>
          <div className="topbar-status">
            <span className={`status-dot ${apiStatus === "Connected" ? "online" : ""}`} />
            <span>API {apiStatus}</span>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="notice error-notice">
              <span>{error}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          )}
          {notice && (
            <div className="notice success-notice">
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}


          {activeView === "books" && duplicateCandidates.length > 0 && (
            <section className="content-panel duplicate-quick-actions">
              <div className="panel-heading">
                <div>
                  <h2>Possible duplicate books found</h2>
                  <p>Review the existing book before continuing.</p>
                </div>
              </div>
              <div className="duplicate-candidate-list">
                {duplicateCandidates.map((book) => (
                  <div className="duplicate-candidate" key={book.id}>
                    <strong>{book.title}</strong>
                    <p>Author: {book.author}</p>
                    <p>Publisher: {book.publisher || "—"}</p>
                  </div>
                ))}
              </div>
              <div className="duplicate-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDuplicateCandidates([]);
                    setBookForm({
                      title: "",
                      author: "",
                      isbn: "",
                      publisher: "",
                      edition: "",
                    });
                    setShowForm(false);
                    setNotice("Existing book kept. No duplicate record was created.");
                  }}
                >
                  Keep existing record
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={createSeparateBookAnyway}
                >
                  This is different — create separately
                </button>
              </div>
            </section>
          )}

          {activeView === "overview" && (
            <>
              <section className="welcome-panel">
                <div>
                  <div className="eyebrow">LIBRARY OPERATIONS</div>
                  <h2>Everything your library needs.</h2>
                  <p>Manage your catalog and institutions from one simple workspace.</p>
                  <button className="primary-button" onClick={() => chooseView("books")}>
                    Explore book catalog <span>→</span>
                  </button>
                </div>
                <div className="welcome-illustration" aria-hidden="true">
                  <div className="book-stack">
                    <span className="book book-one" />
                    <span className="book book-two" />
                    <span className="book book-three" />
                    <span className="book book-four" />
                  </div>
                  <div className="illustration-circle" />
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>At a glance</h2>
                  <p>Your system overview</p>
                </div>
              </div>

              <section className="stat-grid">
                <button className="stat-card" onClick={() => chooseView("books")}>
                  <div className="stat-icon blue">▤</div>
                  <span className="stat-label">Catalog books</span>
                  <strong>{books.length}</strong>
                  <span className="stat-foot">View book catalog <span>↗</span></span>
                </button>
                <button className="stat-card" onClick={() => chooseView("institutions")}>
                  <div className="stat-icon purple">⌂</div>
                  <span className="stat-label">Institutions</span>
                  <strong>{institutions.length}</strong>
                  <span className="stat-foot">View institutions <span>↗</span></span>
                </button>
                <div className="stat-card">
                  <div className="stat-icon green">♙</div>
                  <span className="stat-label">Members loaded</span>
                  <strong>{members.length}</strong>
                  <span className="stat-foot">Choose an institution to view members</span>
                </div>
                <div className="stat-card">
                  <div className="stat-icon orange">⇄</div>
                  <span className="stat-label">Loans loaded</span>
                  <strong>{loans.length}</strong>
                  <span className="stat-foot">Choose an institution to view loans</span>
                </div>
              </section>

              <section className="content-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recently added books</h2>
                    <p>Books currently in the shared catalog</p>
                  </div>
                  <button className="text-button" onClick={() => chooseView("books")}>View all →</button>
                </div>
                {books.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">▤</div>
                    <strong>No books in the catalog yet</strong>
                    <p>Add your first book to start building the collection.</p>
                    <button className="primary-button" onClick={() => { chooseView("books"); setShowForm(true); }}>
                      + Add a book
                    </button>
                  </div>
                ) : (
                  <div className="book-list">
                    {books.slice(0, 5).map((book, index) => (
                      <div className="book-row" key={book.id || `${book.title}-${index}`}>
                        <div className="mini-book">▤</div>
                        <div className="book-row-info">
                          <strong>{displayValue(book.title)}</strong>
                          <span>{displayValue(book.author)}</span>
                        </div>
                        <span className="subtle-label">{displayValue(book.publisher)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeView !== "overview" && (
            <>
              <div className="section-heading resource-heading">
                <div>
                  <h2>{titles[activeView]}</h2>
                  <p>
                    {activeView === "books" && "Search and manage the shared book catalog."}
                    {activeView === "institutions" && "Register and view participating institutions."}
                    {activeView === "members" && "Members belong to a specific institution."}
                    {activeView === "loans" && "Review circulation records for an institution."}
                  </p>
                </div>
                {(
                  (activeView === "books" &&
                    (isSuperAdmin || hasRole("INSTITUTION_ADMIN", "LIBRARIAN"))) ||
                  (activeView === "copies" &&
                    (isSuperAdmin || hasRole("INSTITUTION_ADMIN", "LIBRARIAN"))) ||
                  (activeView === "institutions" && isSuperAdmin) ||
                  (activeView === "members" &&
                    (isSuperAdmin || hasRole("INSTITUTION_ADMIN", "LIBRARIAN"))) ||
                  (activeView === "users" && canManageUsers)
                ) && (
                  <button
                    className="primary-button"
                    onClick={() => {
                      if ((activeView === "members" || activeView === "users" || activeView === "copies") && !selectedInstitution) {
                        setError("Select an institution before registering a member.");
                        return;
                      }
                      setError("");
                      setShowForm(!showForm);
                    }}
                  >
                    {showForm ? "Cancel" : "+ Add " + (
                      activeView === "books" ? "book" :
                      activeView === "institutions" ? "institution" : activeView === "copies" ? "copy" : activeView === "members" ? "member" : "user"
                    )}
                  </button>
                )}
              </div>

              {activeView === "members" || activeView === "loans" || activeView === "settings" || activeView === "users" || activeView === "copies" ? (
                <section className="content-panel filter-panel">
                  <label htmlFor="institution-select">Select institution</label>
                  <select
                    id="institution-select"
                    value={selectedInstitution}
                    onChange={(event) => setSelectedInstitution(event.target.value)}
                  >
                    <option value="">Choose an institution...</option>
                    {institutions.map((institution) => (
                      <option key={institution.id} value={institution.id}>
                        {institution.name}
                      </option>
                    ))}
                  </select>
                  {!selectedInstitution && (
                    <p className="helper-text">Select an institution above to load its {activeView}.</p>
                  )}
                </section>
              ) : null}

              {activeView === "settings" && selectedInstitution && (
                <form className="content-panel form-panel" onSubmit={submitSettings}>
                  <h3>Circulation rules</h3>
                  <p className="helper-text">
                    These rules apply to new loans for the selected institution.
                  </p>
                  <div className="form-grid">
                    <label>Loan period (days) *
                      <input
                        type="number"
                        min="1"
                        max="90"
                        required
                        value={settingsForm.loanDays}
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, loanDays: event.target.value })
                        }
                      />
                    </label>
                    <label>Maximum active loans per member *
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={settingsForm.maxLoans}
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, maxLoans: event.target.value })
                        }
                      />
                    </label>
                    <label>Late fee per day *
                      <input
                        type="number"
                        min="0"
                        max="100000"
                        step="0.01"
                        required
                        value={settingsForm.finePerDay}
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, finePerDay: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button className="primary-button" type="submit">Save settings</button>
                  <p className="helper-text">
                    Overdue loans are updated automatically. The late fee is calculated when the book is returned, using this institution's daily fine rate.
                  </p>
                </form>
              )}

              {activeView === "loans" && selectedInstitution && (
                <form className="content-panel form-panel" onSubmit={submitLoan}>
                  <h3>Borrow a book</h3>
                  <p className="helper-text">
                    Select an active member and an available book copy from this institution.
                  </p>
                  <div className="form-grid">
                    <label>Library member *
                      <select
                        required
                        value={loanForm.memberId}
                        onChange={(event) =>
                          setLoanForm({ ...loanForm, memberId: event.target.value })
                        }
                      >
                        <option value="">Choose a member...</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName} — {member.membershipNumber}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>Available book copy *
                      <select
                        required
                        value={loanForm.bookCopyId}
                        onChange={(event) =>
                          setLoanForm({ ...loanForm, bookCopyId: event.target.value })
                        }
                      >
                        <option value="">Choose a book copy...</option>
                        {books.flatMap((book) =>
                          (book.copiesAsBook || [])
                            .filter(
                              (copy) =>
                                copy.institutionId === selectedInstitution &&
                                copy.status === "AVAILABLE"
                            )
                            .map((copy) => ({ ...copy, bookTitle: book.title }))
                        ).map((copy) => (
                          <option key={copy.id} value={copy.id}>
                            {copy.bookTitle} — {copy.barcode}
                            {copy.shelfLocation ? ` (${copy.shelfLocation})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button className="primary-button" type="submit">
                    Record book loan
                  </button>
                  <p className="helper-text">
                    The return date follows the institution's configured loan period.
                  </p>
                </form>
              )}

              {showForm && activeView === "copies" && selectedInstitution && (
                <form className="content-panel form-panel" onSubmit={submitCopy}>
                  <h3>Register a physical book copy</h3>
                  <p className="helper-text">
                    Select the book, enter a unique barcode, and add its shelf location.
                  </p>
                  <div className="form-grid">
                    <label>Book *
                      <select
                        required
                        value={copyForm.bookId}
                        onChange={(event) => setCopyForm({
                          ...copyForm,
                          bookId: event.target.value
                        })}
                      >
                        <option value="">Choose a book...</option>
                        {books.map((book) => (
                          <option key={book.id} value={book.id}>
                            {book.title} — {book.author}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>Barcode *
                      <input
                        required
                        value={copyForm.barcode}
                        onChange={(event) => setCopyForm({
                          ...copyForm,
                          barcode: event.target.value
                        })}
                        placeholder="e.g. WAG-BOOK-0002"
                      />
                    </label>
                    <label>Shelf location
                      <input
                        value={copyForm.shelfLocation}
                        onChange={(event) => setCopyForm({
                          ...copyForm,
                          shelfLocation: event.target.value
                        })}
                        placeholder="e.g. A-02"
                      />
                    </label>
                  </div>
                  <button className="primary-button" type="submit">
                    Register book copy
                  </button>
                </form>
              )}

              {showForm && activeView === "members" && selectedInstitution && (
                <form className="content-panel form-panel" onSubmit={submitMember}>
                  <h3>Register a library member</h3>
                  <p className="helper-text">
                    This member will belong to the selected institution.
                  </p>
                  <div className="form-grid">
                    <label>Membership number *
                      <input
                        required
                        value={memberForm.membershipNumber}
                        onChange={(event) => setMemberForm({
                          ...memberForm,
                          membershipNumber: event.target.value
                        })}
                        placeholder="e.g. MEM-0002"
                      />
                    </label>
                    <label>Full name *
                      <input
                        required
                        value={memberForm.fullName}
                        onChange={(event) => setMemberForm({
                          ...memberForm,
                          fullName: event.target.value
                        })}
                        placeholder="Enter member's full name"
                      />
                    </label>
                    <label>Email
                      <input
                        type="email"
                        value={memberForm.email}
                        onChange={(event) => setMemberForm({
                          ...memberForm,
                          email: event.target.value
                        })}
                        placeholder="member@example.com"
                      />
                    </label>
                    <label>Phone
                      <input
                        value={memberForm.phone}
                        onChange={(event) => setMemberForm({
                          ...memberForm,
                          phone: event.target.value
                        })}
                        placeholder="Phone number"
                      />
                    </label>
                  </div>
                  <button className="primary-button" type="submit">
                    Register member
                  </button>
                </form>
              )}

              {showForm && activeView === "users" && selectedInstitution && (
                <form className="content-panel form-panel" onSubmit={submitUser}>
                  <h3>Create an institution user</h3>
                  <p className="helper-text">
                    Create a login account and assign a role in the selected institution.
                    Only Super Admin can assign the Institution Admin role.
                  </p>
                  <div className="form-grid">
                    <label>Full name *
                      <input
                        required
                        value={userForm.fullName}
                        onChange={(event) => setUserForm({
                          ...userForm,
                          fullName: event.target.value
                        })}
                        placeholder="Enter full name"
                      />
                    </label>
                    <label>Email *
                      <input
                        type="email"
                        required
                        value={userForm.email}
                        onChange={(event) => setUserForm({
                          ...userForm,
                          email: event.target.value
                        })}
                        placeholder="user@example.com"
                      />
                    </label>
                    <label>Password * (at least 8 characters)
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={userForm.password}
                        onChange={(event) => setUserForm({
                          ...userForm,
                          password: event.target.value
                        })}
                        placeholder="Create a temporary password"
                      />
                    </label>
                    <label>Role *
                      <select
                        required
                        value={userForm.role}
                        onChange={(event) => setUserForm({
                          ...userForm,
                          role: event.target.value
                        })}
                      >
                        <option value="LIBRARIAN">Librarian</option>
                        {isSuperAdmin && (
                          <option value="INSTITUTION_ADMIN">Institution Admin</option>
                        )}
                        <option value="TEACHER">Teacher</option>
                        <option value="STUDENT">Student</option>
                        <option value="PARENT">Parent</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    </label>
                  </div>
                  <button className="primary-button" type="submit">
                    Create user account
                  </button>
                </form>
              )}

              {showForm && activeView === "books" && (
                <form className="content-panel form-panel" onSubmit={submitBook}>
                  <h3>Add a book to the catalog</h3>
                  <div className="form-grid">
                    <label>Book title *
                      <input required value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} placeholder="Enter the book title" />
                    </label>
                    <label>Author *
                      <input required value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} placeholder="Enter the author name" />
                    </label>
                    <label>ISBN
                      <input value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} placeholder="ISBN number" />
                    </label>
                    <label>Publisher
                      <input value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })} placeholder="Publisher name" />
                    </label>
                    <label>Edition
                      <input value={bookForm.edition} onChange={(e) => setBookForm({ ...bookForm, edition: e.target.value })} placeholder="e.g. 2nd edition" />
                    </label>
                  </div>
                  <button className="primary-button" type="submit">Save book</button>
                </form>
              )}

              {showForm && activeView === "institutions" && (
                <form className="content-panel form-panel" onSubmit={submitInstitution}>
                  <h3>Register a new institution</h3>
                  <p className="helper-text">New institutions may need Super Admin approval before using library services.</p>
                  <div className="form-grid">
                    <label>Institution name *
                      <input required value={institutionForm.name} onChange={(e) => setInstitutionForm({ ...institutionForm, name: e.target.value })} placeholder="e.g. Central School Library" />
                    </label>
                    <label>Institution code
                      <input value={institutionForm.slug} onChange={(e) => setInstitutionForm({ ...institutionForm, slug: e.target.value })} placeholder="Optional unique code" />
                    </label>
                    <label>Email
                      <input type="email" value={institutionForm.email} onChange={(e) => setInstitutionForm({ ...institutionForm, email: e.target.value })} placeholder="library@example.com" />
                    </label>
                  </div>
                  <button className="primary-button" type="submit">Register institution</button>
                </form>
              )}

              {activeView !== "settings" && (
              <section className="content-panel table-panel">
                <div className="table-topline">
                  <strong>{currentList.length} record{currentList.length === 1 ? "" : "s"}</strong>
                  <span className="subtle-label">Live API data</span>
                </div>
                {currentList.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">{activeView === "books" ? "▤" : activeView === "institutions" ? "⌂" : "↗"}</div>
                    <strong>No records to display</strong>
                    <p>
                      {activeView === "books" && "Add a book to start your catalog."}
                      {activeView === "institutions" && "Register your first institution."}
                      {activeView === "members" && (selectedInstitution ? "No members were returned for this institution." : "Select an institution above first.")}
                      {activeView === "loans" && (selectedInstitution ? "No loans were returned for this institution." : "Select an institution above first.")}
                    </p>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>{(columns[activeView] || []).map(([key, label]) => <th key={key}>{label}</th>)}{((activeView === "institutions" && isSuperAdmin) ||
                            activeView === "loans") && <th>Actions</th>}</tr>
                      </thead>
                      <tbody>
                        {currentList.map((record, index) => (
                          <tr key={record.id || `${activeView}-${index}`}>
                            {(columns[activeView] || []).map(([key]) => (
                              <td key={key}>
                                {key === "status" ? (
                                  <span className={`record-status ${String(record[key] || "").toLowerCase()}`}>
                                    {displayValue(record[key])}
                                  </span>
                                ) : displayValue(record[key])}
                              </td>
                            ))}
                            {activeView === "institutions" && isSuperAdmin && (
                              <td>
                                {record.status === "PENDING" ? (
                                  <div className="row-actions">
                                    <button type="button" className="approve-button"
                                      onClick={() => updateInstitutionStatus(record.id, "approve")}>
                                      Approve
                                    </button>
                                    <button type="button" className="reject-button"
                                      onClick={() => updateInstitutionStatus(record.id, "reject")}>
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="subtle-label">Reviewed</span>
                                )}
                              </td>
                            )}
                            {activeView === "loans" && (
                              <td>
                                {["ACTIVE", "OVERDUE"].includes(record.status) ? (
                                  <button
                                    type="button"
                                    className="return-button"
                                    onClick={() => returnLoan(record.id)}
                                  >
                                    Return book
                                  </button>
                                ) : (
                                  <span className="subtle-label">No action needed</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>Libra Library Management System</span>
            <span>Development workspace · Backend {apiStatus}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

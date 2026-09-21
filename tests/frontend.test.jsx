import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// Components to test
import RootlineLogin from "../src/RootlineLogin.jsx";
import RootlineRegister from "../src/RootlineRegister.jsx";
import RootlineForgotPassword from "../src/RootlineForgotPassword.jsx";
import RootlineResetPassword from "../src/RootlineResetPassword.jsx";
import RootlineOAuthCallback from "../src/RootlineOAuthCallback.jsx";
import RootlineDashboard from "../src/RootlineDashboard.jsx";
import PeopleList from "../src/family/PeopleList.jsx";
import PersonDetail from "../src/family/PersonDetail.jsx";
import PersonForm from "../src/family/PersonForm.jsx";

// Mock API
vi.mock("../src/api.js", () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    googleLoginUrl: vi.fn(() => "http://localhost:3000/auth/google/login"),
    me: vi.fn().mockResolvedValue({ id: "user-1", email: "tester@example.com", name: "Tester" }),
    listPeople: vi.fn().mockResolvedValue([]),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    deletePerson: vi.fn(),
    sendContactMessage: vi.fn(),
  },
}));

// Mock AuthContext
vi.mock("../src/AuthContext.jsx", () => {
  const mockUser = { id: "user-1", name: "Tester", email: "tester@example.com" };
  return {
    useAuth: () => ({
      user: mockUser,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    }),
    AuthProvider: ({ children }) => <div>{children}</div>,
  };
});

// Mock FamilyContext
const mockPeopleData = [
  {
    id: "p1",
    name: "Grandfather Arthur",
    gender: "male",
    dob: "1920-04-12",
    place_of_birth: "London",
    occupation: "Carpenter",
    address: "22 Baker St",
    phone: "+44 20 7946 0912",
    notes: "Master woodworker",
    parentIds: [],
    spouseIds: ["p2"],
  },
  {
    id: "p2",
    name: "Grandmother Beatrice",
    gender: "female",
    dob: "1925-08-20",
    place_of_birth: "York",
    occupation: "Botanist",
    address: "22 Baker St",
    phone: "+44 20 7946 0913",
    notes: "Studied rare alpine flora",
    parentIds: [],
    spouseIds: ["p1"],
  },
];

vi.mock("../src/family/FamilyContext.jsx", () => ({
  useFamily: () => ({
    people: mockPeopleData,
    loading: false,
    deletePerson: vi.fn(),
    addPerson: vi.fn(),
    updatePerson: vi.fn(),
    getPerson: (id) => mockPeopleData.find((p) => p.id === id) || null,
    setRootPerson: vi.fn(),
    rootPersonId: "p1",
  }),
  FamilyProvider: ({ children }) => <div>{children}</div>,
}));

describe("Frontend UI Test Suite (Issue 16)", () => {
  describe("RootlineLogin component", () => {
    it("renders login form with email, password fields and Google OAuth option", () => {
      render(
        <MemoryRouter>
          <RootlineLogin />
        </MemoryRouter>
      );

      expect(screen.getByText(/welcome back/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/enter your email/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/enter your password/i)).toBeDefined();
      expect(screen.getByText(/continue with google/i)).toBeDefined();
    });

    it("allows filling pre-seeded demo user", () => {
      render(
        <MemoryRouter>
          <RootlineLogin />
        </MemoryRouter>
      );

      const fillDemoBtn = screen.getByText(/fill demo/i);
      expect(fillDemoBtn).toBeDefined();
      fireEvent.click(fillDemoBtn);

      const emailInput = screen.getByPlaceholderText(/enter your email/i);
      expect(emailInput.value).toBe("rootline.seed@example.com");
    });
  });

  describe("RootlineRegister component", () => {
    it("renders registration fields: name, email, password", () => {
      render(
        <MemoryRouter>
          <RootlineRegister />
        </MemoryRouter>
      );

      expect(screen.getByText(/create your account/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/enter your full name/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/enter your email/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/create a password/i)).toBeDefined();
    });
  });

  describe("Password Reset Flows (Forgot & Reset Password)", () => {
    it("renders Forgot Password form with email prompt", () => {
      render(
        <MemoryRouter>
          <RootlineForgotPassword />
        </MemoryRouter>
      );

      expect(screen.getByText(/reset your password/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/enter your email/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /send reset link/i })).toBeDefined();
    });

    it("renders Reset Password form when token is present", () => {
      render(
        <MemoryRouter initialEntries={["/reset-password?token=valid-test-token"]}>
          <Routes>
            <Route path="/reset-password" element={<RootlineResetPassword />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/set a new password/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/enter a new password/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /update password/i })).toBeDefined();
    });

    it("displays error when reset token is missing upon submit", () => {
      render(
        <MemoryRouter initialEntries={["/reset-password"]}>
          <Routes>
            <Route path="/reset-password" element={<RootlineResetPassword />} />
          </Routes>
        </MemoryRouter>
      );

      const passInput = screen.getByPlaceholderText(/enter a new password/i);
      fireEvent.change(passInput, { target: { value: "myNewPassword123" } });
      const submitBtn = screen.getByRole("button", { name: /update password/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/this reset link is missing its token/i)).toBeDefined();
    });
  });

  describe("OAuth Callback component", () => {
    it("renders signing you in status during redirect processing", async () => {
      render(
        <MemoryRouter initialEntries={["/oauth-callback?status=success"]}>
          <Routes>
            <Route path="/oauth-callback" element={<RootlineOAuthCallback />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/signing you in/i)).toBeDefined();
      });
    });
  });

  describe("RootlineDashboard component", () => {
    it("renders dashboard greeting and people summary metrics", () => {
      render(
        <MemoryRouter>
          <RootlineDashboard />
        </MemoryRouter>
      );

      expect(screen.getByText(/welcome, tester/i)).toBeDefined();
      expect(screen.getByText(/people added/i)).toBeDefined();
      expect(screen.getByText(/generations mapped/i)).toBeDefined();
    });
  });

  describe("PeopleList & Search UI (Issues 18 & 25)", () => {
    it("renders searchable directory with filter chips and people counts", () => {
      render(
        <MemoryRouter>
          <PeopleList />
        </MemoryRouter>
      );

      expect(screen.getByPlaceholderText(/search people or relationships/i)).toBeDefined();
      expect(screen.getByText(/2 people in your tree/i)).toBeDefined();
      expect(screen.getByText("Grandfather Arthur")).toBeDefined();
      expect(screen.getByText("Grandmother Beatrice")).toBeDefined();
    });

    it("filters people list by search query", () => {
      render(
        <MemoryRouter>
          <PeopleList />
        </MemoryRouter>
      );

      const searchInput = screen.getByPlaceholderText(/search people or relationships/i);
      fireEvent.change(searchInput, { target: { value: "Beatrice" } });

      // Relationship-aware search also finds Arthur because he is linked to Beatrice.
      expect(screen.getByText("Grandmother Beatrice")).toBeDefined();
      expect(screen.getByText("Grandfather Arthur")).toBeDefined();
    });

    it("shows zero-state message when search yields no matches", () => {
      render(
        <MemoryRouter>
          <PeopleList />
        </MemoryRouter>
      );

      const searchInput = screen.getByPlaceholderText(/search people or relationships/i);
      fireEvent.change(searchInput, { target: { value: "NonexistentPerson123" } });

      expect(screen.getByText(/no people match/i)).toBeDefined();
    });
  });

  describe("PersonDetail Read-Only Profile Page (Issue 27)", () => {
    it("renders full profile with all vitals, occupations, and family connections", () => {
      render(
        <MemoryRouter initialEntries={["/people/p1"]}>
          <Routes>
            <Route path="/people/:id" element={<PersonDetail />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText("Grandfather Arthur")).toBeDefined();
      expect(screen.getAllByText(/carpenter/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/london/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/22 baker st/i)).toBeDefined();
      expect(screen.getByText(/\+44 20 7946 0912/i)).toBeDefined();
      expect(screen.getByText(/master woodworker/i)).toBeDefined();
      expect(screen.getByText(/focus tree/i)).toBeDefined();
    });

    it("renders fallback state when person does not exist", () => {
      render(
        <MemoryRouter initialEntries={["/people/unknown-999"]}>
          <Routes>
            <Route path="/people/:id" element={<PersonDetail />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/person not found/i)).toBeDefined();
    });
  });

  describe("PersonForm component (Issue 26)", () => {
    it("exposes all fields including place of birth and occupation", () => {
      render(
        <MemoryRouter initialEntries={["/people/new"]}>
          <Routes>
            <Route path="/people/new" element={<PersonForm />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByPlaceholderText(/e\.g\. mangalore, karnataka/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/e\.g\. civil engineer, teacher/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/e\.g\. 12 mg road, bengaluru/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/e\.g\. \+91 98765 43210/i)).toBeDefined();
    });
  });
});

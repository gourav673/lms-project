import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { RowDataPacket } from "mysql2";
import db from "@/utils/db";
import { Role } from "@/types";

// Define ApprovedUser type
type ApprovedUser = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role: Role;
    department: string;
    semester: number;
    created_at: string;
};

// Extend NextAuth types for session & user role
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: Role;
            first_name: string;
            last_name: string;
            email?: string;
            department?: string;
            semester: number;
        };
    }
    interface User {
        role: Role;
        department: string;
        first_name: string;
        last_name: string;
        semester: number;
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials");
                }

                try {
                    // Fetch user from MySQL (Include `semester`)
                    const [rows]: [RowDataPacket[], unknown] = await db.query(
                        `SELECT id, first_name, last_name, email, password, role_id AS role, 
                                department, semester, created_at 
                         FROM users WHERE email = ?`,
                        [credentials.email]
                    );

                    if (rows.length === 0) throw new Error("No user found!");

                    const user = rows[0] as ApprovedUser;
                    const isValidPassword = await bcrypt.compare(credentials.password, user.password);
                    if (!isValidPassword) throw new Error("Invalid password!");

                    return { 
                        id: user.id.toString(), 
                        first_name: user.first_name,
                        last_name: user.last_name,
                        name: `${user.first_name} ${user.last_name}`, 
                        email: user.email, 
                        role: user.role,
                        department: user.department,
                        semester: user.semester,
                    };
                } catch (error) {
                    console.error("Authentication Error:", error);
                    throw new Error("Invalid email or password");
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.email = user.email;
                token.department = user.department;
                token.first_name = user.first_name;
                token.last_name = user.last_name;
                token.semester = user.semester;
            }
            return token;
        },
        async session({ session, token }) {
            session.user = {
                id: token.id as string,
                role: token.role as Role || "student",
                email: token.email || "",
                department: token.department as string || "",
                first_name: token.first_name as string || "",
                last_name: token.last_name as string || "",
                semester: token.semester as number || 1, // Default to 1
            };
            
            console.log("Generated Session:", session); // Log session in the terminal
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET, 
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
};

export default NextAuth(authOptions);
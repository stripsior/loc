# LOC - Lines of Code Counter

A premium, high-performance web application to analyze GitHub repositories. Get instant insights into lines of code, language distributions, and repository metadata with beautiful visualizations.

![LOC Preview](/public/og.png)

## 🚀 Features

- **Instant Analysis**: Fetch LOC data for any public or private GitHub repository.
- **Language Breakdown**: View detailed statistics in both tabular and interactive Pie Chart formats.
- **Branch Support**: Easily switch between branches to compare code volume.
- **Private Repository Support**: Analyze private repositories using GitHub personal access tokens.
- **Smart Caching**: Powered by React Query for lightning-fast subsequent loads.
- **Premium UI**: Sleek dark mode design with glassmorphism effects and smooth transitions.
- **Privacy First**: Anonymous usage tracking via PostHog.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Data Fetching**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
- **Visualizations**: [Recharts](https://recharts.org/)
- **Animations**: [Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Analytics**: [PostHog](https://posthog.com/)

## 🏁 Getting Started

### Prerequisites

- Node.js 20+
- npm / yarn / pnpm

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/stripsior/loc.git
   cd loc
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root and add your configuration:

   ```env
   NEXT_PUBLIC_POSTHOG_KEY=your_key
   NEXT_PUBLIC_POSTHOG_HOST=your_host
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

   - `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`: PostHog analytics credentials (optional)
   - `NEXT_PUBLIC_API_URL`: URL of the backend API server (defaults to `http://localhost:8080`)

4. **Run the development server**:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📄 License

This project is open-source and available under the MIT License.

## 🙏 Credits

- Frontend built with ❤️ by [stripsior](https://github.com/stripsior).

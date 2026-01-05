# LOC - Lines of Code Counter

A premium, high-performance web application to analyze GitHub repositories. Get instant insights into lines of code, language distributions, and repository metadata with beautiful visualizations.

![LOC Preview](/public/og.png)

## 🚀 Features

- **Instant Analysis**: Fetch LOC data for any public GitHub repository.
- **Language Breakdown**: View detailed statistics in both tabular and interactive Pie Chart formats.
- **Branch Support**: Easily switch between branches to compare code volume.
- **Smart Caching**: Powered by React Query for lightning-fast subsequent loads.
- **Advanced Filtering**: Ignore specific files or directories from the count.
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
- **API**: [Codetabs LOC API](https://codetabs.com/)

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
   Create a `.env` file in the root and add your PostHog credentials:

   ```env
   NEXT_PUBLIC_POSTHOG_KEY=your_key
   NEXT_PUBLIC_POSTHOG_HOST=your_host
   ```

4. **Run the development server**:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📄 License

This project is open-source and available under the MIT License.

## 🙏 Credits

- Analysis data provided by [Codetabs](https://codetabs.com).
- Frontend built with ❤️ by [stripsior](https://github.com/stripsior).

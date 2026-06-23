export const MOUTH_PATHS = {
  idle: "M 10 10 Q 20 18 30 10", // Gentle smile
  engaged: "M 10 12 Q 20 22 30 12", // Deeper cute smile
  error: "M 15 15 A 5 5 0 1 0 25 15 A 5 5 0 1 0 15 15", // "Ah" round open mouth
  success: "M 8 10 Q 20 25 32 10", // Wide happy smile
  hidden: "M 15 10 L 25 10", // Straight neutral line
};

export const CHEEK_COLORS = {
  idle: "rgba(255, 105, 180, 0.2)",
  engaged: "rgba(255, 20, 147, 0.4)", // Deeper pink glow when touched
  error: "rgba(239, 68, 68, 0.4)", // Reddish glow
  success: "rgba(34, 197, 94, 0.4)", // Greenish glow
  hidden: "rgba(255, 105, 180, 0.1)",
};

export const QUOTES = [
  "Welcome back, The Genius!",
  "Ready to build something amazing?",
  "Let's create magic today.",
  "Your creative workspace awaits.",
  "Hello there, mastermind!"
];

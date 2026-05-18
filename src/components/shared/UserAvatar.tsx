import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  image?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
}

/**
 * UserAvatar: Reusable avatar component that follows the brand color palette globally.
 * When no image is provided, it displays the name initials with the brand color.
 */
export function UserAvatar({ name, image, className, size = "default" }: UserAvatarProps) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <Avatar size={size} className={cn("rounded-sm border border-border/30", className)}>
      {image && <AvatarImage src={image} alt={name} className="object-cover" />}
      <AvatarFallback className="bg-primary text-primary-foreground font-bold uppercase tracking-tight">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

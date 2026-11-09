import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({
  user,
  className,
}: {
  user?: { firstName: string; lastName: string; avatar?: string | null } | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      {user?.avatar ? <AvatarImage src={user.avatar} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{initials(user)}</AvatarFallback>
    </Avatar>
  );
}

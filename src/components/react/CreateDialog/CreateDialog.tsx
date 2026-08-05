import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { forwardRef, useId, type MouseEvent, type ReactNode } from "react";
import "./CreateDialog.css";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  onClose?: () => void;
};

function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}

const CreateDialog = forwardRef<HTMLDialogElement, Props>(function CreateDialog(
  { title, description, children, onClose },
  ref
) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={ref}
      className="create-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={closeOnBackdrop}
      onClose={onClose}
    >
      <div className="create-dialog__card">
        <header className="create-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => event.currentTarget.closest("dialog")?.close()}
            aria-label="Cerrar"
          >
            <X />
          </Button>
        </header>
        {children}
      </div>
    </dialog>
  );
});

export default CreateDialog;

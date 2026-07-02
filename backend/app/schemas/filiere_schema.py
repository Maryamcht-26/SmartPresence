from pydantic import BaseModel

class FiliereBase(BaseModel):
    nom: str


class FiliereCreate(FiliereBase):
    pass

class FiliereResponse(FiliereBase):
    id: int

    class Config:
        from_attributes = True
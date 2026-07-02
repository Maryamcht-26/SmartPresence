from pydantic import BaseModel

class NiveauBase(BaseModel):
    nom: str
    filiere_id: int


class NiveauCreate(NiveauBase):
    pass

class NiveauResponse(NiveauBase):
    id: int

    class Config:
    
        from_attributes = True